<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class FileImageRuleService
{
    public const COLLECTION = 'user_export_images';

    public function mediaId(string $rule): ?int
    {
        return preg_match('/^%image:user:(\d+)%$/', $rule, $matches) === 1
            ? (int) $matches[1]
            : null;
    }

    public function assertOwnedRules(array $payload, User $owner): void
    {
        preg_match_all('/%image:user:(\d+)%/', json_encode($payload, JSON_THROW_ON_ERROR), $matches);
        foreach (array_unique(array_map('intval', $matches[1])) as $id) {
            if (! $this->media($id, $owner)) {
                throw ValidationException::withMessages([
                    'template' => 'Une image fixe est absente ou ne vous appartient pas.',
                ]);
            }
        }
    }

    public function media(int $id, ?User $owner = null): ?Media
    {
        return Media::query()
            ->whereKey($id)
            ->where('collection_name', self::COLLECTION)
            ->when($owner, fn ($query) => $query
                ->where('model_type', $owner->getMorphClass())
                ->where('model_id', $owner->getKey()))
            ->first();
    }

    public function url(int $id, string $conversion = 'document', ?User $owner = null): string
    {
        $media = $this->media($id, $owner);

        return $media?->hasGeneratedConversion($conversion)
            ? $media->getUrl($conversion)
            : ($media?->getUrl() ?? '');
    }

    public function temporaryPath(int $id, array &$temporaryFiles, ?User $owner = null): ?string
    {
        $media = $this->media($id, $owner);
        if (! $media) {
            return null;
        }
        $conversion = $media->hasGeneratedConversion('document') ? 'document' : '';
        $disk = Storage::disk($conversion ? ($media->conversions_disk ?: $media->disk) : $media->disk);
        $relativePath = $conversion
            ? $media->getPathRelativeToRoot($conversion)
            : $media->getPathRelativeToRoot();
        if (! $disk->exists($relativePath) || $disk->size($relativePath) > 5 * 1024 * 1024) {
            return null;
        }
        $stream = $disk->readStream($relativePath);
        if (! is_resource($stream)) {
            return null;
        }
        $path = tempnam(sys_get_temp_dir(), 'file_image_');
        if ($path === false) {
            fclose($stream);

            return null;
        }
        $output = fopen($path, 'wb');
        stream_copy_to_stream($stream, $output);
        fclose($stream);
        fclose($output);
        $temporaryFiles[] = $path;

        return @getimagesize($path) ? $path : null;
    }
}
