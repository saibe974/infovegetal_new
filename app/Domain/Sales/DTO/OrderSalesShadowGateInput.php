<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowGateInput
{
    public function __construct(
        public OrderSalesShadowBatchInput $batchInput,
        public int $minimumOrdersForLimitedRollout = 50,
        public int $minimumOrdersForGeneralRollout = 500,
    ) {
    }
}
