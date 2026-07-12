<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowGovernanceRunner
{
    public function __construct(
        private readonly OrderSalesShadowGateRunner $gateRunner = new OrderSalesShadowGateRunner(),
        private readonly OrderSalesShadowRolloutPlanBuilder $rolloutPlanBuilder = new OrderSalesShadowRolloutPlanBuilder(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowGovernanceInput $input)
    {
        $gateResult = $this->gateRunner->run($input->gateInput);

        $rolloutPlan = $this->rolloutPlanBuilder->build(
            result: $gateResult,
            generatedAtUtc: $input->planGeneratedAtUtc,
            limitedStartPercent: $input->limitedStartPercent,
            limitedEndPercent: $input->limitedEndPercent,
            hoursPerStep: $input->hoursPerStep,
        );

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceResult';

        return new $resultClass(
            gateResult: $gateResult,
            rolloutPlan: $rolloutPlan,
        );
    }
}
