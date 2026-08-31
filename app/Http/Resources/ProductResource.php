<?php

namespace App\Http\Resources;

use App\Domain\Sales\DTO\ProductVatResolutionInput;
use App\Domain\Sales\Services\ProductVatResolver;
use App\Domain\Sales\Services\SalesConditionRelationResolver;
use App\Domain\Sales\Services\SalesConditionSnapshotResolver;
use App\Domain\Sales\ValueObjects\Percentage;
use App\Models\Carrier;
use App\Models\ClientSalesCondition;
use App\Models\DbProductBillingUser;
use App\Models\Product;
use App\Services\PriceCalculatorService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

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
        if (! $user) {
            return null;
        }

        $dbProductId = (int) ($this->resource->db_products_id ?? 0);
        if ($dbProductId <= 0) {
            return null;
        }

        $resolved = app(PriceCalculatorService::class)->resolveUserAttributes($user, $dbProductId);
        if (is_array($resolved) && $resolved !== []) {
            return $resolved;
        }

        $dbProduct = $user->dbProducts()->where('db_product_id', $dbProductId)->first();
        $pivotAttributes = $dbProduct?->pivot?->attributes;

        if (! $pivotAttributes) {
            return null;
        }

        $decoded = is_string($pivotAttributes)
            ? json_decode($pivotAttributes, true)
            : $pivotAttributes;

        // dd($decoded);

        return is_array($decoded) ? $decoded : null;
    }

    protected function resolveDbUserTransport(Request $request, ?array $dbUserAttributes = null): ?array
    {
        $preloaded = $this->resource->getAttribute('db_user_transport');
        if (is_array($preloaded)) {
            return $preloaded;
        }

        $attrs = $dbUserAttributes ?? $this->resolveDbUserAttributes($request);
        if (! $attrs) {
            return null;
        }

        $transportChoice = self::resolveTransportChoiceFromAttributes($attrs);
        $carrierId = $transportChoice['carrier_id'];
        $zoneId = $transportChoice['zone_id'];

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
        if (! $carrier || ! $zone) {
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
     * @param  array<string, mixed>  $attrs
     * @return array{carrier_id:int,zone_id:int}
     */
    public static function resolveTransportChoiceFromAttributes(array $attrs): array
    {
        $legacyCarrierId = (int) ($attrs['t'] ?? 0);
        $legacyZoneId = (int) ($attrs['z'] ?? 0);

        if ($legacyCarrierId > 0 && $legacyZoneId > 0) {
            return [
                'carrier_id' => $legacyCarrierId,
                'zone_id' => $legacyZoneId,
            ];
        }

        $raw = $attrs['t'] ?? null;
        $parsed = is_string($raw) ? json_decode($raw, true) : $raw;
        if (! is_array($parsed) || empty($parsed)) {
            return [
                'carrier_id' => 0,
                'zone_id' => 0,
            ];
        }

        $preferredZoneId = (int) ($attrs['z'] ?? 0);
        $selected = null;

        foreach ($parsed as $option) {
            if (! is_array($option)) {
                continue;
            }

            $carrierId = (int) ($option['carrier_id'] ?? 0);
            $zoneId = (int) ($option['zone_id'] ?? 0);
            if ($carrierId <= 0 || $zoneId <= 0) {
                continue;
            }

            if ($preferredZoneId > 0 && $zoneId === $preferredZoneId) {
                $selected = $option;
                break;
            }

            if ($selected === null) {
                $selected = $option;
            }
        }

        if (! is_array($selected)) {
            return [
                'carrier_id' => 0,
                'zone_id' => 0,
            ];
        }

        return [
            'carrier_id' => (int) ($selected['carrier_id'] ?? 0),
            'zone_id' => (int) ($selected['zone_id'] ?? 0),
        ];
    }

    protected function resolveTvaRate(): float
    {
        $ratesById = DB::table('tva')->pluck('rate', 'id');
        $productVatRate = $this->resolvePercentageRate($this->resource->tva_id, $ratesById);
        $categoryVatRate = $this->resolvePercentageRate($this->resource->category?->tva_id, $ratesById);
        $categoryId = $this->resource->category_products_id ? (int) $this->resource->category_products_id : null;

        if ($categoryId === null) {
            return $productVatRate?->basisPoints !== null
                ? round($productVatRate->basisPoints / 100, 2)
                : 0.0;
        }

        if ($productVatRate === null && $categoryVatRate === null) {
            return 0.0;
        }

        try {
            $resolution = (new ProductVatResolver)->resolve(new ProductVatResolutionInput(
                productId: (int) $this->resource->id,
                categoryId: $categoryId,
                productVatRate: $productVatRate,
                categoryVatRate: $categoryVatRate,
            ));

            return round($resolution->vatRate->basisPoints / 100, 2);
        } catch (\DomainException) {
            return 0.0;
        }
    }

    protected function resolvePercentageRate(mixed $tvaId, Collection $ratesById): ?Percentage
    {
        $resolvedTvaId = (int) ($tvaId ?? 0);
        if ($resolvedTvaId <= 0) {
            return null;
        }

        $rawRate = $ratesById->get($resolvedTvaId);
        if ($rawRate === null) {
            return null;
        }

        return Percentage::fromString((string) $rawRate);
    }

    protected function extractPositiveMargin(?array $conditions): ?float
    {
        if (! is_array($conditions) || ! array_key_exists('m', $conditions) || ! is_numeric($conditions['m'])) {
            return null;
        }

        $margin = (float) $conditions['m'];

        // `m = 0` is an explicit override and must not fall back to inherited/default margins.
        return $margin;
    }

    protected function resolveVisibleMarginPercent(Request $request, ?array $dbUserAttributes): ?float
    {
        $user = $request->user();
        $dbProductId = (int) ($this->resource->db_products_id ?? 0);

        if ($user && $dbProductId > 0) {
            $billingUserId = isset($dbUserAttributes['fact']) ? (int) $dbUserAttributes['fact'] : null;
            $sellerUserId = isset($dbUserAttributes['com']) ? (int) $dbUserAttributes['com'] : null;

            if (! $billingUserId || ! $sellerUserId) {
                $clientRule = ClientSalesCondition::query()
                    ->where('client_user_id', (int) $user->id)
                    ->where('db_product_id', $dbProductId)
                    ->where('active', true)
                    ->latest('updated_at')
                    ->first(['billing_user_id', 'seller_user_id']);

                if ($clientRule) {
                    $billingUserId ??= (int) ($clientRule->billing_user_id ?? 0);
                    $sellerUserId ??= (int) ($clientRule->seller_user_id ?? 0);
                }
            }

            if ($billingUserId) {
                $billingRule = DbProductBillingUser::query()
                    ->where('db_product_id', $dbProductId)
                    ->where('billing_user_id', $billingUserId)
                    ->where('active', true)
                    ->first();

                $defaults = is_array($billingRule?->defaults) ? $billingRule->defaults : [];
                $relationResolver = new SalesConditionRelationResolver;
                $snapshotResolver = new SalesConditionSnapshotResolver;

                $sellerRuleData = $relationResolver->resolveSellerRuleData($dbProductId, $billingUserId, $sellerUserId ?: null);
                $clientOverride = $relationResolver->resolveClientOverride($dbProductId, $billingUserId, $sellerUserId ?: null, (int) $user->id);

                $billingMargin = $this->extractPositiveMargin(
                    $snapshotResolver->extractProfileConditionsById(
                        $defaults,
                        isset($sellerRuleData['billing_profile_id']) ? (string) $sellerRuleData['billing_profile_id'] : null,
                    )
                );

                $commercialMargin = null;
                if (! empty($sellerRuleData)) {
                    if ((bool) ($sellerRuleData['use_billing_profile'] ?? true)) {
                        $commercialMargin = $this->extractPositiveMargin(
                            $snapshotResolver->extractDefaultConditions(
                                is_array($sellerRuleData['seller_defaults'] ?? null) ? $sellerRuleData['seller_defaults'] : []
                            )
                        );
                    } else {
                        $commercialMargin = $this->extractPositiveMargin(
                            is_array($sellerRuleData['conditions'] ?? null) ? $sellerRuleData['conditions'] : []
                        );
                    }
                }

                $clientOverrideMargin = $this->extractPositiveMargin($clientOverride);
                if ($clientOverrideMargin !== null) {
                    return $clientOverrideMargin;
                }

                $totalMargin = ($billingMargin ?? 0.0) + ($commercialMargin ?? 0.0);
                if ($totalMargin > 0) {
                    return $totalMargin;
                }
            }
        }

        return $this->extractPositiveMargin($dbUserAttributes);
    }

    /** Prices shared by catalogue rendering and exports, with the same user context. */
    public function resolvedPrices(Request $request): array
    {
        $dbUserAttributes = $this->resolveDbUserAttributes($request);
        $user = $request->user();
        $isImpersonated = $user && method_exists($user, 'isImpersonated') && $user->isImpersonated();
        $isAdminView = $user && $user->hasRole('admin') && ! $isImpersonated;

        $price = $this->price;
        $priceFloor = $this->price_floor;
        $priceRoll = $this->price_roll;
        $pricePromo = $this->price_promo;

        if ($user && $this->resource->db_products_id && (! $isAdminView || $dbUserAttributes)) {
            $calculator = app(PriceCalculatorService::class);
            $prices = $calculator->calculatePrice($this->resource, $user, (int) $this->resource->db_products_id);
            $price = $prices[0] ?? $price;
            $priceFloor = $prices[1] ?? $priceFloor;
            $priceRoll = $prices[2] ?? $priceRoll;
            $pricePromo = $prices[3] ?? $pricePromo;
        }

        return ['price' => $price, 'price_floor' => $priceFloor, 'price_roll' => $priceRoll, 'price_promo' => $pricePromo, 'db_user_attributes' => $dbUserAttributes];
    }

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        ['price' => $price, 'price_floor' => $priceFloor, 'price_roll' => $priceRoll, 'price_promo' => $pricePromo, 'db_user_attributes' => $dbUserAttributes] = $this->resolvedPrices($request);

        $effectivePrice = (float) $price;

        $priceTtc = $effectivePrice;
        $tvaRate = $this->resolveTvaRate();
        if ($effectivePrice > 0 && $tvaRate > 0) {
            $priceTtc = round($effectivePrice * (1 + ($tvaRate / 100)), 2);
        }

        return [
            'id' => $this->resource->id,
            'sku' => $this->resource->sku,
            'name' => $this->name,
            'description' => $this->description,
            'img_link' => $this->img_link,
            'image_original' => $this->resource->getFirstMediaUrl('images') ?: $this->img_link,
            'image_medium' => $this->resource->getFirstMediaUrl('images', 'medium')
                // ?: $this->resource->getFirstMediaUrl('images', 'small')
                ?: $this->resource->getFirstMediaUrl('images')
                ?: $this->img_link,
            'image_thumb' => $this->resource->getFirstMediaUrl('images', 'thumb')
                // ?: $this->resource->getFirstMediaUrl('images', 'small')
                // ?: $this->resource->getFirstMediaUrl('images', 'medium')
                ?: $this->resource->getFirstMediaUrl('images')
                ?: $this->img_link,
            'price' => $price,
            'price_ttc' => $priceTtc,
            'active' => $this->active,
            'available_from' => $this->available_from?->format('Y-m-d\TH:i'),
            'available_until' => $this->available_until?->format('Y-m-d\TH:i'),
            'availability_status' => $this->resource->availabilityStatusAt(),
            'attributes' => $this->attributes,
            'category_products_id' => $this->category_products_id,
            'db_products_id' => $this->db_products_id,
            'db_user_attributes' => $dbUserAttributes,
            'db_user_transport' => $this->resolveDbUserTransport($request, $dbUserAttributes),
            'ref' => $this->ref,
            'ean13' => $this->ean13,
            'pot' => $this->pot,
            'height' => $this->height,
            'price_floor' => $priceFloor,
            'price_roll' => $priceRoll,
            'price_promo' => $pricePromo,
            'producer_id' => $this->producer_id,
            'tva_id' => $this->tva_id,
            'cond' => $this->cond,
            'floor' => $this->floor,
            'roll' => $this->roll,
            'unite' => $this->unite,
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
