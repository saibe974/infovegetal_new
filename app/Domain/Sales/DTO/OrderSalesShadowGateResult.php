<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowGateResult
{
    public function __construct(
        public OrderSalesShadowBatchResult $batchResult,
        public ShadowModeGateDecision $gateDecision,
    ) {
    }
}
