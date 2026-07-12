<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPipelineInput
{
    public function __construct(
        public OrderSalesShadowReleaseReadinessInput $readinessInput,
        public string $manifestGeneratedAtUtc,
        public string $schemaVersion = '1.0',
    ) {
    }
}
