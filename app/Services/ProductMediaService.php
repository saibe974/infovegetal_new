<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class ProductMediaService
{
    public function syncFromImgLink(Product $product, ?string $imgLink): bool
    {
        $imgLink = is_string($imgLink) ? trim($imgLink) : null;
        if (!$imgLink || !$this->isRemoteUrl($imgLink)) {
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

            if (!$response->successful()) {
                throw new RuntimeException('HTTP ' . $response->status());
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
            Log::warning('Product image download failed', [
                'product_id' => $product->id,
                'url' => $imgLink,
                'error' => $e->getMessage(),
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

        if (!$this->isRemoteUrl($imgLink)) {
            return [
                'ok' => false,
                'message' => 'URL image distante invalide',
                'downloaded' => false,
            ];
        }

        $downloaded = $this->syncFromImgLink($product, $imgLink);
        $product->refresh();

        return [
            'ok' => $downloaded,
            'message' => $downloaded ? 'Image telechargee' : 'Image deja presente ou echec',
            'downloaded' => $downloaded,
            'has_local' => (bool) $product->getFirstMedia('images'),
            'local_url' => $product->getFirstMediaUrl('images') ?: null,
            'thumb_url' => $product->getFirstMediaUrl('images', 'thumb') ?: null,
            'small_url' => $product->getFirstMediaUrl('images', 'small') ?: null,
            'medium_url' => $product->getFirstMediaUrl('images', 'medium') ?: null,
        ];
    }

    public function compareRemoteWithLocal(Product $product): array
    {
        $imgLink = (string) $product->getRawOriginal('img_link');
        if (!$this->isRemoteUrl($imgLink)) {
            return [
                'ok' => false,
                'message' => 'URL distante invalide',
            ];
        }

        $media = $product->getFirstMedia('images');
        if (!$media) {
            return [
                'ok' => false,
                'message' => 'Aucune image locale',
                'similarity' => null,
            ];
        }

        $response = Http::timeout(20)->get($imgLink);
        if (!$response->successful()) {
            return [
                'ok' => false,
                'message' => 'Impossible de recuperer l\'image distante',
            ];
        }

        $remoteHash = md5($response->body());
        $localPath = $media->getPath();

        if (!is_file($localPath)) {
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
        if (!$media) {
            $download = $this->downloadMissing($product);
            if (!$download['ok']) {
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

    public function removeImgLinkIfMissing(Product $product): array
    {
        $imgLink = (string) $product->getRawOriginal('img_link');

        if (!$this->isRemoteUrl($imgLink)) {
            $product->forceFill(['img_link' => null])->save();
            $product->refresh();

            return [
                'ok' => true,
                'removed' => true,
                'message' => 'img_link supprime: URL invalide',
                'preview_url' => $this->previewUrl($product),
            ];
        }

        if ($this->remoteImageExists($imgLink)) {
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
            'message' => 'img_link supprime: image distante introuvable',
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
            $base = 'product-' . $product->id;
        }

        return $base . '.' . $extension;
    }

    private function isRemoteUrl(string $value): bool
    {
        if (!filter_var($value, FILTER_VALIDATE_URL)) {
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
