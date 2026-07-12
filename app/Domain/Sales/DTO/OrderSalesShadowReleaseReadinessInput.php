<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseReadinessInput
{
    public function __construct(
        public OrderSalesShadowReleasePipelineInput $pipelineInput,
        public string $executionPlanGeneratedAtUtc,
        public string $executionPackageGeneratedAtUtc,
        public string $readinessGeneratedAtUtc,
    ) {
    }
}
