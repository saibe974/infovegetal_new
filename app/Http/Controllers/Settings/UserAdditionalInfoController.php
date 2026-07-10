<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserMeta;
use App\Models\UserOption;
use App\Services\UserManagementAuthorizationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class UserAdditionalInfoController extends Controller
{
    public function __construct(
        private readonly UserManagementAuthorizationService $authorization,
    ) {
    }

    public function storeMeta(Request $request, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();

        $this->authorizeTarget($request, $target);

        $validated = $request->validate([
            'key' => ['required', 'string', 'max:255'],
            'custom_key' => ['nullable', 'string', 'max:255', 'required_if:key,custom'],
            'value' => ['nullable', 'string'],
            'value_json' => ['nullable', 'array'],
            'value_file' => ['nullable', 'file', 'image', 'max:5120'],
            'type' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        [$metaKey, $metaType, $metaValue] = $this->resolveMetaPayload($request, $target, $validated);

        $target->usersMeta()->create([
            'key' => $metaKey,
            'value' => $metaValue,
            'type' => $metaType,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return back()->with('success', 'Champ complementaire ajoute');
    }

    public function updateMeta(Request $request, UserMeta $meta, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();

        $this->authorizeTarget($request, $target);

        if ((int) $meta->user_id !== (int) $target->id) {
            abort(404);
        }

        $validated = $request->validate([
            'key' => ['required', 'string', 'max:255'],
            'custom_key' => ['nullable', 'string', 'max:255', 'required_if:key,custom'],
            'value' => ['nullable', 'string'],
            'value_json' => ['nullable', 'array'],
            'value_file' => ['nullable', 'file', 'image', 'max:5120'],
            'type' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        [$metaKey, $metaType, $metaValue] = $this->resolveMetaPayload($request, $target, $validated, $meta);

        $meta->update([
            'key' => $metaKey,
            'value' => $metaValue,
            'type' => $metaType,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return back()->with('success', 'Champ complementaire mis a jour');
    }

    public function destroyMeta(Request $request, UserMeta $meta, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();

        $this->authorizeTarget($request, $target);

        if ((int) $meta->user_id !== (int) $target->id) {
            abort(404);
        }

        $existingMediaId = $this->extractMediaId($meta->value);
        if ($existingMediaId) {
            Media::query()->whereKey($existingMediaId)->delete();
        }

        $meta->delete();

        return back()->with('success', 'Champ complementaire supprime');
    }

    private function authorizeTarget(Request $request, User $target): void
    {
        $actor = $request->user();

        if (!$actor) {
            abort(403, 'Unauthorized');
        }

        $this->authorize('update', $target);
    }

    private function metaKeyConfig(): array
    {
        $kinds = UserOption::query()
            ->where('key', 'users_meta.input_kind')
            ->where('active', true)
            ->get(['value', 'label', 'type'])
            ->keyBy('value');

        $fields = UserOption::query()
            ->where('key', 'users_meta.input_fields')
            ->where('active', true)
            ->get(['value', 'label'])
            ->keyBy('value');

        $config = [];
        foreach ($kinds as $value => $row) {
            $fieldRow = $fields->get($value);
            $config[$value] = [
                'input' => (string) ($row->label ?: $row->type ?: 'input'),
                'fields' => $fieldRow && $fieldRow->label
                    ? array_values(array_filter(array_map('trim', explode(',', (string) $fieldRow->label))))
                    : [],
            ];
        }

        return $config;
    }

    private function resolveMetaPayload(Request $request, User $target, array $validated, ?UserMeta $existingMeta = null): array
    {
        $key = (string) ($validated['key'] ?? '');
        if ($key === 'custom') {
            $key = (string) ($validated['custom_key'] ?? '');
        }

        if ($key === '') {
            abort(422, 'Invalid key');
        }

        $config = $this->metaKeyConfig();
        $inputKind = $config[$key]['input'] ?? null;

        $value = $validated['value'] ?? null;

        if ($inputKind === 'json') {
            $value = !empty($validated['value_json'])
                ? json_encode($validated['value_json'])
                : null;
        } elseif (($inputKind === 'file/image' || $key === 'logo') && $request->hasFile('value_file')) {
            $collection = $key === 'logo' ? 'user_logos' : 'user_meta_files';

            $previousMediaId = $existingMeta ? $this->extractMediaId($existingMeta->value) : null;
            if ($previousMediaId) {
                Media::query()->whereKey($previousMediaId)->delete();
            }

            if ($collection === 'user_logos') {
                $target->clearMediaCollection('user_logos');
            }

            $media = $target
                ->addMediaFromRequest('value_file')
                ->toMediaCollection($collection);

            $value = json_encode([
                'media_id' => $media->id,
                'collection' => $collection,
                'url' => $media->getUrl(),
                'file_name' => $media->file_name,
            ]);
        }

        $type = $validated['type'] ?? $inputKind;

        return [$key, $type, $value];
    }

    private function extractMediaId(?string $value): ?int
    {
        if (!$value) {
            return null;
        }

        $decoded = json_decode($value, true);
        if (is_array($decoded) && isset($decoded['media_id'])) {
            return (int) $decoded['media_id'];
        }

        return null;
    }
}
