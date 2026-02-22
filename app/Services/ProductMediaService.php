<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\Log;

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

    private function isRemoteUrl(string $value): bool
    {
        if (!filter_var($value, FILTER_VALIDATE_URL)) {
            return false;
        }

        return (bool) preg_match('#^https?://#i', $value);
    }
}
