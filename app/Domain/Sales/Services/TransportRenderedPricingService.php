<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Support\RenderedTransportCalculator;

final class TransportRenderedPricingService
{
    /**
     * @param array<int, float|int|string> $rollFillRates
     */
    public function calculate(array $rollFillRates, float $pricePerRoll, float $carrierMinimum): float
    {
        return RenderedTransportCalculator::calculateRenderedTransportCost($rollFillRates, $pricePerRoll, $carrierMinimum);
    }
}