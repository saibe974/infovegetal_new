<?php

namespace App\Media\PathGenerator;

use App\Models\Product;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\MediaLibrary\Support\PathGenerator\PathGenerator;

class ProductPathGenerator implements PathGenerator
{
    public function getPath(Media $media): string
    {
        return $this->basePath($media);
    }

    public function getPathForConversions(Media $media): string
    {
        return $this->basePath($media) . 'conversions/';
    }

    public function getPathForResponsiveImages(Media $media): string
    {
        return $this->basePath($media) . 'responsive-images/';
    }

    private function basePath(Media $media): string
    {
        $model = $media->model;

        if ($model instanceof Product) {
            $categoryId = (int) ($model->category_products_id ?? 0);
            $categoryFolder = $categoryId > 0 ? (string) $categoryId : 'uncategorized';

            return 'products/' . $categoryFolder . '/';
        }

        // Fallback defensif
        return (string) $media->getKey() . '/';
    }
}
