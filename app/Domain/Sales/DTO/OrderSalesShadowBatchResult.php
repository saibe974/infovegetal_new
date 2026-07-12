<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowBatchResult
{
    /**
     * @param list<SalesOrderCalculationResult> $calculations
     */
    public function __construct(
        public array $calculations,
        public ShadowModeBatchReport $report,
    ) {
        foreach ($calculations as $calculation) {
            if (!$calculation instanceof SalesOrderCalculationResult) {
                throw new \InvalidArgumentException('OrderSalesShadowBatchResult calculations must be SalesOrderCalculationResult instances.');
            }
        }
    }
}
