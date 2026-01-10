<?php

namespace App\Http\Resources;

use App\Models\Product;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * $property Product $resource
 */
class ProductResource extends JsonResource
{
    public static $wrap = null;

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'sku' => $this->resource->sku,
            'name' => $this->name,
            'description' => $this->description,
            'img_link' => $this->img_link,
            'price' => $this->price,
            'active' => $this->active,
            'attributes' => $this->attributes,
            'category_products_id' => $this->category_products_id,
            'db_products_id' => $this->db_products_id,
            'ref' => $this->ref,
            'ean13' => $this->ean13,
            'pot' => $this->pot,
            'height' => $this->height,
            'price_floor' => $this->price_floor,
            'price_roll' => $this->price_roll,
            'price_promo' => $this->price_promo,
            'producer_id' => $this->producer_id,
            'tva_id' => $this->tva_id,
            'cond' => $this->cond,
            'floor' => $this->floor,
            'roll' => $this->roll,
            'category' => $this->whenLoaded('category', fn () => $this->category),
            'producer' => $this->whenLoaded('producer', fn () => $this->producer),
            'dbProduct' => $this->whenLoaded('dbProduct', fn () => $this->dbProduct),
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->map(function ($t) {
                return [
                    'id' => $t->id,
                    'name' => $t->name,
                    'slug' => $t->slug,
                ];
            })->values()->all()),
            'created_at' => $this->created_at?->toDateTimeString(),
            'updated_at' => $this->updated_at?->toDateTimeString(),
            'deleted_at' => $this->deleted_at?->toDateTimeString(),
        ];
    }
}
