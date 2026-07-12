<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPipelineResult
{
    public function __construct(
        public OrderSalesShadowReleaseReadinessResult $readinessResult,
        public OrderSalesShadowReleaseManifest $manifest,
        public OrderSalesShadowReleaseManifestVerification $manifestVerification,
    ) {
    }
}
