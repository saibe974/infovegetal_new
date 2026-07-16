<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class ProductPriceFallbackResolver
{
    /**
     * BR-007
     * BR-008
     *
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    public function resolve(
        float $standardUnitPrice,
        float $floorUnitPrice,
        float $rollUnitPrice,
        float $promoUnitPrice,
        bool $enforcePositiveMinimum = true,
        bool $preferFloorForRollFallback = false,
    ): array {
        $base = 0.0;

        foreach ([$standardUnitPrice, $floorUnitPrice, $rollUnitPrice] as $candidate) {
            if ($candidate > 0) {
                $base = $candidate;
                break;
            }
        }

        $fallback = $enforcePositiveMinimum
            ? ($base > 0 ? $base : 0.01)
            : $base;

        return [
            $standardUnitPrice > 0 ? $standardUnitPrice : $fallback,
            $floorUnitPrice > 0 ? $floorUnitPrice : $fallback,
            $this->resolveRollPrice(
                standardUnitPrice: $standardUnitPrice,
                floorUnitPrice: $floorUnitPrice,
                rollUnitPrice: $rollUnitPrice,
                fallback: $fallback,
                preferFloorForRollFallback: $preferFloorForRollFallback,
            ),
            $promoUnitPrice > 0 ? $promoUnitPrice : 0.0,
        ];
    }

    /**
     * BR-008
     */
    private function resolveRollPrice(
        float $standardUnitPrice,
        float $floorUnitPrice,
        float $rollUnitPrice,
        float $fallback,
        bool $preferFloorForRollFallback,
    ): float {
        if ($rollUnitPrice > 0) {
            return $rollUnitPrice;
        }

        if ($preferFloorForRollFallback && $floorUnitPrice > 0) {
            return $floorUnitPrice;
        }

        return $fallback;
    }
}