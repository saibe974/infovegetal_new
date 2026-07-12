<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class SalesOrderCalculationResult
{
    public function __construct(
        public OrderCalculationBreakdown $orderBreakdown,
        public CustomerInvoiceProjection $customerInvoice,
        public ExpectedSettlementCollection $expectedSettlements,
        public SalesCalculationSnapshot $snapshot,
        public ?LegacyComparisonReport $legacyComparisonReport,
        public ShadowModeEvaluation $shadowModeEvaluation,
    ) {
    }
}
