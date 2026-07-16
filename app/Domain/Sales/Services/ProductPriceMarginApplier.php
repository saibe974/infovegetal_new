<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class ProductPriceMarginApplier
{
    /**
     * BR-014
     * BR-015
        * BR-016
        * BR-017
     */
    public function apply(
        float $baseUnitPrice,
        float $tierMarginPercent,
        float $finalMarginPercent,
        float $minimumMarginPerUnit,
        float $deliveryPerUnit,
        float $weightingPercent,
        int|string $priceMode,
    ): float {
        if ($baseUnitPrice == 0.0) {
            return 0.0;
        }

        $adjustedPrice = $baseUnitPrice + max($minimumMarginPerUnit, $tierMarginPercent * $baseUnitPrice / 100);

        if ($priceMode == 1 && $deliveryPerUnit != 0.0) {
            $adjustedPrice += $deliveryPerUnit;
        }

        if ($weightingPercent != 0.0) {
            $adjustedPrice = $adjustedPrice / ((100 - $weightingPercent) / 100);
        }

        $adjustedPrice += $finalMarginPercent * $baseUnitPrice / 100;

        return $adjustedPrice;
    }
}