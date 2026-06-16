<?php

namespace App\Support;

class RenderedTransportCalculator
{
    /**
     * @param array<int, float|int|string> $rollFillRates
     */
    public static function calculateRenderedTransportCost(array $rollFillRates, float $pricePerRoll, float $carrierMinimum): float
    {
        if (empty($rollFillRates) || $pricePerRoll <= 0.0) {
            return 0.0;
        }

        $normalized = array_map(static function ($fillRate): float {
            $value = (float) $fillRate;
            if ($value < 0.0) {
                return 0.0;
            }
            if ($value > 1.0) {
                return 1.0;
            }
            return $value;
        }, $rollFillRates);

        $rollCount = count($normalized);
        $theoreticalTotal = $pricePerRoll * $rollCount;
        $realCarrierCost = max(max(0.0, $carrierMinimum), $theoreticalTotal);

        $alreadyIncluded = 0.0;
        foreach ($normalized as $fillRate) {
            $alreadyIncluded += $pricePerRoll * $fillRate;
        }

        return max(0.0, $realCarrierCost - $alreadyIncluded);
    }
}
