<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowBatchInput
{
    /**
     * @param list<OrderSalesCalculationInput> $orders
     */
    public function __construct(
        public array $orders,
        public string $generatedAtUtc,
        public int $maxWarningRatePercentForPromote = 10,
        public int $maxSkippedRatePercentForPromote = 20,
        public int $topIssuesLimit = 20,
    ) {
        foreach ($orders as $order) {
            if (!$order instanceof OrderSalesCalculationInput) {
                throw new \InvalidArgumentException('OrderSalesShadowBatchInput orders must be OrderSalesCalculationInput instances.');
            }
        }
    }
}
