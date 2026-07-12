<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowGovernanceInput
{
    public function __construct(
        public OrderSalesShadowGateInput $gateInput,
        public string $planGeneratedAtUtc,
        public int $limitedStartPercent = 10,
        public int $limitedEndPercent = 50,
        public int $hoursPerStep = 24,
    ) {
    }
}
