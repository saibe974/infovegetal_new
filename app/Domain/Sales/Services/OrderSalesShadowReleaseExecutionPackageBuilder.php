<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseExecutionPackageBuilder
{
    public function __construct(
        private readonly OrderSalesShadowReleasePipelineRunner $pipelineRunner = new OrderSalesShadowReleasePipelineRunner(),
        private readonly OrderSalesShadowReleasePipelineResultSerializer $pipelineSerializer = new OrderSalesShadowReleasePipelineResultSerializer(),
        private readonly OrderSalesShadowReleaseExecutionPlanBuilder $executionPlanBuilder = new OrderSalesShadowReleaseExecutionPlanBuilder(),
        private readonly OrderSalesShadowReleaseExecutionPlanSerializer $executionPlanSerializer = new OrderSalesShadowReleaseExecutionPlanSerializer(),
    ) {
    }

    /**
     * @return object
     */
    public function build(
        \App\Domain\Sales\DTO\OrderSalesShadowReleasePipelineInput $pipelineInput,
        string $executionPlanGeneratedAtUtc,
        string $packageGeneratedAtUtc,
    ) {
        $pipelineResult = $this->pipelineRunner->run($pipelineInput);
        $executionPlan = $this->executionPlanBuilder->build($pipelineResult, $executionPlanGeneratedAtUtc);

        $pipelineArray = $this->pipelineSerializer->toArray($pipelineResult);
        $pipelineJson = $this->pipelineSerializer->toJson($pipelineResult);

        $executionPlanArray = $this->executionPlanSerializer->toArray($executionPlan);
        $executionPlanJson = $this->executionPlanSerializer->toJson($executionPlan);

        $packageClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseExecutionPackage';

        return new $packageClass(
            generatedAtUtc: $packageGeneratedAtUtc,
            pipelineResult: $pipelineResult,
            executionPlan: $executionPlan,
            pipelineArray: $pipelineArray,
            pipelineJson: $pipelineJson,
            executionPlanArray: $executionPlanArray,
            executionPlanJson: $executionPlanJson,
        );
    }
}
