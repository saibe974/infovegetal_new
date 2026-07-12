<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowBatchRunner
{
    public function __construct(
        private readonly OrderSalesChainCalculator $orderCalculator = new OrderSalesChainCalculator(),
        private readonly ShadowModeBatchReportBuilder $reportBuilder = new ShadowModeBatchReportBuilder(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowBatchInput $input)
    {
        $calculations = [];

        foreach ($input->orders as $orderInput) {
            $calculations[] = $this->orderCalculator->calculate($orderInput);
        }

        $report = $this->reportBuilder->build(
            results: $calculations,
            generatedAtUtc: $input->generatedAtUtc,
            maxWarningRatePercentForPromote: $input->maxWarningRatePercentForPromote,
            maxSkippedRatePercentForPromote: $input->maxSkippedRatePercentForPromote,
            topIssuesLimit: $input->topIssuesLimit,
        );

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowBatchResult';

        return new $resultClass(
            calculations: $calculations,
            report: $report,
        );
    }
}
