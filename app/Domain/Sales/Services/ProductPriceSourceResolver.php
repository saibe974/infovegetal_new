<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\ProductPriceReference;
use App\Domain\Sales\DTO\ProductTaxContext;
use App\Domain\Sales\DTO\ResolvedConditionCollection;
use App\Domain\Sales\Enums\PriceSourceType;
use App\Domain\Sales\Enums\SalesMode;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;
use App\Domain\Sales\ValueObjects\Quantity;
use App\Models\Product;

final class ProductPriceSourceResolver
{
    public function __construct(
        private readonly ProductSalesPriceCalculator $calculator = new ProductSalesPriceCalculator(),
        private readonly ProductPriceFallbackResolver $fallbackResolver = new ProductPriceFallbackResolver(),
    ) {
    }

    /**
     * BR-001
     *
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    public function resolveStandardPrices(Product $product): array
    {
        $prices = [
            (float) ($product->price ?? 0),
            (float) ($product->price_floor ?? 0),
            (float) ($product->price_roll ?? 0),
            (float) ($product->price_promo ?? 0),
        ];

        if (($product->price ?? 0) <= 0) {
            return $prices;
        }

        try {
            $priceMinor = (int) round(((float) ($product->price ?? 0)) * 100);

            $result = $this->calculator->calculate(new LineCalculationInput(
                lineId: (int) ($product->id ?? 1),
                priceReference: new ProductPriceReference(
                    productId: (int) ($product->id ?? 1),
                    dbProductId: (int) ($product->db_products_id ?? 0),
                    priceSource: PriceSourceType::Standard,
                    baseUnitPriceHt: new Money($priceMinor, Currency::EUR),
                    weightingPercent: null,
                ),
                quantity: Quantity::fromInt(1),
                actorChain: new ActorChain(0, 0, null),
                conditions: new ResolvedConditionCollection([]),
                taxContext: new ProductTaxContext(Percentage::fromString('0')),
                salesMode: SalesMode::Depart,
            ));

            $targetPrice = ((float) $result->product->finalLineHt->minorAmount) / 100.0;
            if ($targetPrice > 0) {
                $prices[0] = $targetPrice;
            }
        } catch (\Throwable) {
            // Legacy-compatible fallback retained while standard price rollout completes.
        }

        return $prices;
    }

    /**
     * BR-009
     *
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    public function resolveSpecialPriceSet(Product $product, string $priceField): array
    {
        $specialPrice = $this->resolveSpecialUnitPrice($product, $priceField);

        return $this->fallbackResolver->resolve(
            standardUnitPrice: $specialPrice,
            floorUnitPrice: $specialPrice,
            rollUnitPrice: $specialPrice,
            promoUnitPrice: 0.0,
        );
    }

    /**
     * BR-009
     */
    public function normalizePriceMode(mixed $value): int|string
    {
        if ($value === null || $value === '') {
            return 0;
        }

        if (is_int($value) || is_float($value)) {
            $intValue = (int) $value;

            return in_array($intValue, [-1, 0, 1], true) ? $intValue : (string) $value;
        }

        $raw = strtolower(trim((string) $value));

        if ($raw === 'price_depart' || $raw === 'depart' || $raw === 'departure') {
            return 0;
        }

        if (
            $raw === 'price_render'
            || $raw === 'price_rendu'
            || $raw === 'render'
            || $raw === 'rendered'
            || $raw === 'rendu'
        ) {
            return 1;
        }

        if ($raw === '-1' || $raw === '0' || $raw === '1') {
            return (int) $raw;
        }

        return (string) $value;
    }

    /**
     * BR-009
     */
    public function resolveSpecialUnitPrice(Product $product, string $priceField): float
    {
        return (float) ($product->{$priceField} ?? $product->price ?? 0);
    }
}