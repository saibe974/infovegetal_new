<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserMeta;
use App\Models\UserOption;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class UserMetaSyncService
{
    public function sync(User $user, array $metas): void
    {
        DB::transaction(function () use ($user, $metas): void {
            $existing = $user->usersMeta()
                ->where('key', '!=', 'logo')
                ->get()
                ->keyBy('id');
            $keptIds = [];
            $config = $this->metaKeyConfig();

            foreach ($metas as $index => $payload) {
                $key = trim((string) ($payload['key'] ?? ''));
                if ($key === '' || $key === 'logo') {
                    throw ValidationException::withMessages([
                        "metas.$index.key" => 'La clé du champ dynamique est invalide.',
                    ]);
                }

                $id = (int) ($payload['id'] ?? 0);
                $meta = $id > 0 ? $existing->get($id) : null;
                if ($id > 0 && !$meta) {
                    throw ValidationException::withMessages([
                        "metas.$index.id" => 'Le champ dynamique sélectionné est invalide.',
                    ]);
                }

                $inputKind = $config[$key] ?? (string) ($payload['type'] ?? 'input');
                $file = $payload['value_file'] ?? null;
                $this->validateFileType($file, $inputKind, $index);
                $value = $this->resolveValue($user, $payload, $inputKind, $meta);
                $storedType = $inputKind === 'file/pdf' && !($file instanceof UploadedFile) && $meta
                    ? ($meta->type ?: $inputKind)
                    : $inputKind;
                $attributes = [
                    'key' => $key,
                    'title' => trim((string) $payload['title']),
                    'value' => $value,
                    'type' => $storedType,
                    'sort_order' => (int) ($payload['sort_order'] ?? 0),
                ];

                if ($meta) {
                    $meta->update($attributes);
                    $keptIds[] = $meta->id;
                } else {
                    $created = $user->usersMeta()->create($attributes);
                    $keptIds[] = $created->id;
                }
            }

            $existing
                ->reject(fn (UserMeta $meta) => in_array($meta->id, $keptIds, true))
                ->each(function (UserMeta $meta): void {
                    $this->deleteAttachedMedia($meta);
                    $meta->delete();
                });
        });
    }

    private function resolveValue(
        User $user,
        array $payload,
        string $inputKind,
        ?UserMeta $existingMeta,
    ): ?string {
        if ($inputKind === 'json') {
            $json = $payload['value_json'] ?? null;

            return is_array($json) ? json_encode($json) : null;
        }

        $file = $payload['value_file'] ?? null;
        if (in_array($inputKind, ['file/image', 'file/pdf'], true) && $file instanceof UploadedFile) {
            if ($existingMeta) {
                $this->deleteAttachedMedia($existingMeta);
            }

            $media = $user
                ->addMedia($file)
                ->toMediaCollection('user_meta_files');

            return json_encode([
                'media_id' => $media->id,
                'collection' => 'user_meta_files',
                'url' => $media->getUrl(),
                'file_name' => $media->file_name,
                'mime_type' => $media->mime_type,
            ]);
        }

        $value = $payload['value'] ?? null;

        return $value === null ? null : (string) $value;
    }

    private function validateFileType(mixed $file, string $inputKind, int $index): void
    {
        if (!$file instanceof UploadedFile) {
            return;
        }

        $mimeType = (string) $file->getMimeType();
        $isValid = match ($inputKind) {
            'file/image' => str_starts_with($mimeType, 'image/'),
            'file/pdf' => $mimeType === 'application/pdf',
            default => false,
        };

        if (!$isValid) {
            throw ValidationException::withMessages([
                "metas.$index.value_file" => 'Le format du fichier ne correspond pas au type du champ.',
            ]);
        }
    }

    private function deleteAttachedMedia(UserMeta $meta): void
    {
        if (!$meta->value) {
            return;
        }

        $decoded = json_decode($meta->value, true);
        if (is_array($decoded) && isset($decoded['media_id'])) {
            Media::query()->whereKey((int) $decoded['media_id'])->delete();
        }
    }

    /** @return array<string, string> */
    private function metaKeyConfig(): array
    {
        return UserOption::query()
            ->where('key', 'users_meta.input_kind')
            ->where('active', true)
            ->get(['value', 'label', 'type'])
            ->mapWithKeys(fn (UserOption $option) => [
                (string) $option->value => (string) ($option->label ?: $option->type ?: 'input'),
            ])
            ->all();
    }
}
