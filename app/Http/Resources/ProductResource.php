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
            'created_at' => $this->created_at?->toDateTimeString(),
            'updated_at' => $this->updated_at?->toDateTimeString(),
        ];
    }
}
