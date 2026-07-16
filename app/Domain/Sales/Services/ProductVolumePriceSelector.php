<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class ProductVolumePriceSelector
{
    /**
     * BR-002
     * BR-003
     * BR-005
     * BR-006
     */
    public function selectUnitPrice(
        int $quantity,
        int $traySize,
        int $floorSize,
        int $rollSize,
        float $standardUnitPrice,
        float $floorUnitPrice,
        float $rollUnitPrice,
        float $promoUnitPrice,
    ): float {
        $unitPrice = $standardUnitPrice > 0 ? $standardUnitPrice : 0.0;

        if ($rollSize > 0 && $quantity >= $rollSize) {
            if ($promoUnitPrice > 0) {
                return $promoUnitPrice;
            }

            if ($rollUnitPrice > 0) {
                return $rollUnitPrice;
            }
        }

        if ($floorSize > 0 && $floorUnitPrice > 0 && $quantity >= $floorSize) {
            return $floorUnitPrice;
        }

        if ($traySize > 0 && $standardUnitPrice > 0 && $quantity >= $traySize) {
            return $standardUnitPrice;
        }

        return $unitPrice;
    }
}