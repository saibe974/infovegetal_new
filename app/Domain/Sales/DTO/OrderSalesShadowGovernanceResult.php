<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowGovernanceResult
{
    public function __construct(
        public OrderSalesShadowGateResult $gateResult,
        public ShadowModeRolloutPlan $rolloutPlan,
    ) {
    }
}
