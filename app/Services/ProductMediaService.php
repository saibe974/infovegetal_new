<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class ProductMediaService
{
    public function syncFromImgLink(Product $product, ?string $imgLink, ?int &$httpStatus = null): bool
    {
        $httpStatus = null;
        $imgLink = is_string($imgLink) ? trim($imgLink) : null;
        if (! $imgLink || ! $this->isRemoteUrl($imgLink)) {
            return false;
        }

        $existing = $product->getFirstMedia('images');
        if ($existing) {
            $sourceUrl = $existing->getCustomProperty('source_url');
            if (is_string($sourceUrl) && $sourceUrl === $imgLink) {
                return false;
            }
        }

        $temporaryFile = tempnam(sys_get_temp_dir(), 'product-media-');

        if ($temporaryFile === false) {
            Log::warning('Product image temp file creation failed', [
                'product_id' => $product->id,
                'url' => $imgLink,
            ]);

            return false;
        }

        try {
            $response = Http::timeout(30)
                ->connectTimeout(10)
                ->withHeaders([
                    'User-Agent' => 'Infovegetal Media Sync',
                    'Accept' => 'image/*,*/*;q=0.8',
                ])
                ->get($imgLink);

            if (! $response->successful()) {
                $httpStatus = $response->status();

                throw new RuntimeException('HTTP '.$httpStatus, $httpStatus);
            }

            $body = $response->body();
            if ($body === '') {
                throw new RuntimeException('Empty response body');
            }

            if (file_put_contents($temporaryFile, $body) === false) {
                throw new RuntimeException('Failed to write temporary file');
            }

            $product->addMedia($temporaryFile)
                ->usingFileName($this->buildProductFileName($product, $imgLink))
                ->withCustomProperties(['source_url' => $imgLink])
                ->toMediaCollection('images');
        } catch (\Throwable $e) {
            if ($httpStatus === null) {
                $exceptionCode = (int) $e->getCode();
                if ($exceptionCode >= 100 && $exceptionCode <= 599) {
                    $httpStatus = $exceptionCode;
                } elseif (preg_match('/HTTP\s+(\d{3})/i', $e->getMessage(), $matches) === 1) {
                    $httpStatus = (int) ($matches[1] ?? 0) ?: null;
                }
            }

            Log::warning('Product image download failed', [
                'product_id' => $product->id,
                'url' => $imgLink,
                'error' => $e->getMessage(),
                'http_status' => $httpStatus,
            ]);

            return false;
        } finally {
            if (is_file($temporaryFile)) {
                @unlink($temporaryFile);
            }
        }

        return true;
    }

    public function downloadMissing(Product $product): array
    {
        $imgLink = (string) $product->getRawOriginal('img_link');

        // Rend l'action idempotente : si le navigateur est rafraichi pendant
        // une requete reussie, sa reprise peut rejouer le meme identifiant.
        $existing = $product->getFirstMedia('images');
        $localStatus = $this->localImageStatus($product);
        if ($existing && $localStatus['original_exists']) {
            return [
                'ok' => true,
                'message' => 'Image deja presente',
                'downloaded' => false,
                'http_status' => null,
                'has_local' => true,
                'local_url' => $existing->getFullUrl(),
                'thumb_url' => $existing->getFullUrl('thumb'),
                'small_url' => $existing->getFullUrl('small'),
                'medium_url' => $existing->getFullUrl('medium'),
            ];
        }

        // Une ligne media sans fichier physique bloque la detection SQL des
        // images manquantes. On la retire avant de recreer le media.
        if ($existing) {
            $product->clearMediaCollection('images');
            $product->unsetRelation('media');
        }

        if (! $this->isRemoteUrl($imgLink)) {
            return [
                'ok' => false,
                'message' => 'URL image distante invalide',
                'downloaded' => false,
                'http_status' => null,
            ];
        }

        $httpStatus = null;
        $downloaded = $this->syncFromImgLink($product, $imgLink, $httpStatus);
        $product->refresh();

        return [
            'ok' => $downloaded,
            'message' => $downloaded ? 'Image telechargee' : 'Image deja presente ou echec',
            'downloaded' => $downloaded,
            'http_status' => $httpStatus,
            'has_local' => (bool) $product->getFirstMedia('images'),
            'local_url' => $product->getFirstMediaUrl('images') ?: null,
            'thumb_url' => $product->getFirstMediaUrl('images', 'thumb') ?: null,
            'small_url' => $product->getFirstMediaUrl('images', 'small') ?: null,
            'medium_url' => $product->getFirstMediaUrl('images', 'medium') ?: null,
        ];
    }

    /**
     * @return array{has_media: bool, original_exists: bool, reason: string}
     */
    public function localImageStatus(Product $product): array
    {
        $media = $product->getFirstMedia('images');
        if (! $media) {
            return [
                'has_media' => false,
                'original_exists' => false,
                'reason' => 'no_media',
            ];
        }

        try {
            $exists = Storage::disk($media->disk)->exists($media->getPathRelativeToRoot());
        } catch (\Throwable $e) {
            Log::warning('Product local media check failed', [
                'product_id' => $product->id,
                'media_id' => $media->id,
                'error' => $e->getMessage(),
            ]);
            $exists = false;
        }

        return [
            'has_media' => true,
            'original_exists' => $exists,
            'reason' => $exists ? 'ok' : 'missing_file',
        ];
    }

    public function compareRemoteWithLocal(Product $product): array
    {
        $imgLink = (string) $product->getRawOriginal('img_link');
        if (! $this->isRemoteUrl($imgLink)) {
            return [
                'ok' => false,
                'message' => 'URL distante invalide',
            ];
        }

        $media = $product->getFirstMedia('images');
        if (! $media) {
            return [
                'ok' => false,
                'message' => 'Aucune image locale',
                'similarity' => null,
            ];
        }

        $response = Http::timeout(20)->get($imgLink);
        if (! $response->successful()) {
            return [
                'ok' => false,
                'message' => 'Impossible de recuperer l\'image distante',
            ];
        }

        $remoteHash = md5($response->body());
        $localPath = $media->getPath();

        if (! is_file($localPath)) {
            return [
                'ok' => false,
                'message' => 'Fichier local introuvable',
            ];
        }

        $localHash = md5_file($localPath) ?: null;
        $same = $localHash !== null && hash_equals($localHash, $remoteHash);

        return [
            'ok' => true,
            'message' => $same ? 'Images identiques (hash)' : 'Images differentes',
            'same' => $same,
            'local_hash' => $localHash,
            'remote_hash' => $remoteHash,
        ];
    }

    public function ensureThumbnail(Product $product): array
    {
        $media = $product->getFirstMedia('images');
        if (! $media) {
            $download = $this->downloadMissing($product);
            if (! $download['ok']) {
                return [
                    'ok' => false,
                    'message' => 'Impossible de preparer la vignette sans image locale',
                ];
            }
            $product->refresh();
            $media = $product->getFirstMedia('images');
        }

        return [
            'ok' => true,
            'message' => 'Vignette prete',
            'thumbnail_url' => $media ? $media->getFullUrl('thumb') : null,
            'small_url' => $media ? $media->getFullUrl('small') : null,
            'medium_url' => $media ? $media->getFullUrl('medium') : null,
        ];
    }

    public function removeImgLinkIfMissing(Product $product, bool $force = false): array
    {
        $imgLink = (string) $product->getRawOriginal('img_link');

        $mediaRemoved = 0;
        if ($force) {
            $mediaRemoved = $product->media()
                ->where('collection_name', 'images')
                ->count();
            $product->clearMediaCollection('images');
        }

        if (! $this->isRemoteUrl($imgLink)) {
            $product->forceFill(['img_link' => null])->save();
            $product->refresh();

            return [
                'ok' => true,
                'removed' => true,
                'media_removed' => $mediaRemoved,
                'message' => $force
                    ? 'img_link et medias supprimes'
                    : 'img_link supprime: URL invalide',
                'preview_url' => $this->previewUrl($product),
            ];
        }

        if (! $force && $this->remoteImageExists($imgLink)) {
            return [
                'ok' => false,
                'removed' => false,
                'message' => 'Image distante encore accessible',
                'preview_url' => $this->previewUrl($product),
            ];
        }

        $product->forceFill(['img_link' => null])->save();
        $product->refresh();

        return [
            'ok' => true,
            'removed' => true,
            'media_removed' => $mediaRemoved,
            'message' => $force
                ? 'img_link et medias supprimes'
                : 'img_link supprime: image distante introuvable',
            'preview_url' => $this->previewUrl($product),
        ];
    }

    private function buildProductFileName(Product $product, string $imgLink): string
    {
        $path = parse_url($imgLink, PHP_URL_PATH);
        $extension = strtolower((string) pathinfo((string) $path, PATHINFO_EXTENSION));

        if ($extension === '' || strlen($extension) > 5) {
            $extension = 'jpg';
        }

        $base = trim((string) ($product->ref ?: $product->sku ?: $product->id));
        $base = Str::slug($base);
        if ($base === '') {
            $base = 'product-'.$product->id;
        }

        return $base.'.'.$extension;
    }

    private function isRemoteUrl(string $value): bool
    {
        if (! filter_var($value, FILTER_VALIDATE_URL)) {
            return false;
        }

        return (bool) preg_match('#^https?://#i', $value);
    }

    private function remoteImageExists(string $imgLink): bool
    {
        try {
            $headResponse = Http::timeout(15)
                ->connectTimeout(10)
                ->withHeaders([
                    'User-Agent' => 'Infovegetal Media Sync',
                    'Accept' => 'image/*,*/*;q=0.8',
                ])
                ->head($imgLink);

            if ($headResponse->successful()) {
                return true;
            }

            if ($headResponse->status() !== 405) {
                return false;
            }

            $getResponse = Http::timeout(15)
                ->connectTimeout(10)
                ->withHeaders([
                    'User-Agent' => 'Infovegetal Media Sync',
                    'Accept' => 'image/*,*/*;q=0.8',
                    'Range' => 'bytes=0-0',
                ])
                ->get($imgLink);

            return $getResponse->successful();
        } catch (\Throwable $e) {
            Log::warning('Product image existence check failed', [
                'url' => $imgLink,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function previewUrl(Product $product): ?string
    {
        return $product->getFirstMediaUrl('images')
            ?: $product->getFirstMediaUrl('images', 'medium')
            ?: $product->getRawOriginal('img_link');
    }
}
