<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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

        try {
            $product->addMediaFromUrl($imgLink)
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
}
