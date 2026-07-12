<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowGateRunner
{
    public function __construct(
        private readonly OrderSalesShadowBatchRunner $batchRunner = new OrderSalesShadowBatchRunner(),
        private readonly ShadowModeGatePolicy $gatePolicy = new ShadowModeGatePolicy(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowGateInput $input)
    {
        $batchResult = $this->batchRunner->run($input->batchInput);

        $gateDecision = $this->gatePolicy->decide(
            report: $batchResult->report,
            minimumOrdersForLimitedRollout: $input->minimumOrdersForLimitedRollout,
            minimumOrdersForGeneralRollout: $input->minimumOrdersForGeneralRollout,
        );

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGateResult';

        return new $resultClass(
            batchResult: $batchResult,
            gateDecision: $gateDecision,
        );
    }
}
