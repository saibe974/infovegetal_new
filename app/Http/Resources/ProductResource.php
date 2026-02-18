<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\Carrier;
use App\Http\Resources\DbProductsResource;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * $property Product $resource
 */
class ProductResource extends JsonResource
{
    public static $wrap = null;

    protected function resolveDbUserAttributes(Request $request): ?array
    {
        $preloaded = $this->resource->getAttribute('db_user_attributes');
        if (is_array($preloaded)) {
            return $preloaded;
        }

        $user = $request->user();
        if (!$user) {
            return null;
        }

        $dbProductId = (int) ($this->resource->db_products_id ?? 0);
        if ($dbProductId <= 0) {
            return null;
        }

        $dbProduct = $user->dbProducts()->where('db_product_id', $dbProductId)->first();
        $pivotAttributes = $dbProduct?->pivot?->attributes;

        if (!$pivotAttributes) {
            return null;
        }

        $decoded = is_string($pivotAttributes)
            ? json_decode($pivotAttributes, true)
            : $pivotAttributes;

        return is_array($decoded) ? $decoded : null;
    }

    protected function resolveDbUserTransport(Request $request, ?array $dbUserAttributes = null): ?array
    {
        $preloaded = $this->resource->getAttribute('db_user_transport');
        if (is_array($preloaded)) {
            return $preloaded;
        }

        $attrs = $dbUserAttributes ?? $this->resolveDbUserAttributes($request);
        if (!$attrs) {
            return null;
        }

        $carrierId = (int) ($attrs['t'] ?? 0);
        $zoneId = (int) ($attrs['z'] ?? 0);

        if ($carrierId <= 0 || $zoneId <= 0) {
            return null;
        }

        $carrier = Carrier::query()
            ->where('id', $carrierId)
            ->with([
                'zones' => fn ($q) => $q
                    ->where('id', $zoneId)
                    ->select(['id', 'carrier_id', 'name', 'tariffs']),
            ])
            ->first(['id', 'taxgo']);

        $zone = $carrier?->zones?->first();
        if (!$carrier || !$zone) {
            return null;
        }

        return [
            'carrier_id' => (int) $carrier->id,
            'zone_id' => (int) $zone->id,
            'zone_name' => (string) ($zone->name ?? ''),
            'taxgo' => (float) ($carrier->taxgo ?? 0),
            'tariffs' => is_array($zone->tariffs) ? $zone->tariffs : [],
        ];
    }

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $dbUserAttributes = $this->resolveDbUserAttributes($request);

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
            'db_user_attributes' => $dbUserAttributes,
            'db_user_transport' => $this->resolveDbUserTransport($request, $dbUserAttributes),
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
            'dbProduct' => DbProductsResource::make($this->whenLoaded('dbProduct')),
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
