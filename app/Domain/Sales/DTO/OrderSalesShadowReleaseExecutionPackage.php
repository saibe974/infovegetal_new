<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseExecutionPackage
{
    public function __construct(
        public string $generatedAtUtc,
        public OrderSalesShadowReleasePipelineResult $pipelineResult,
        public OrderSalesShadowReleaseExecutionPlan $executionPlan,
        public array $pipelineArray,
        public string $pipelineJson,
        public array $executionPlanArray,
        public string $executionPlanJson,
    ) {
    }
}
