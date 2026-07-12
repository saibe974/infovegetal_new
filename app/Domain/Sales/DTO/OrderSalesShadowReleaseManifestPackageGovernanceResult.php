<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPackageGovernanceResult
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPackageResult $packageResult,
        public OrderSalesShadowReleaseManifestPublicationDecision $publicationDecision,
    ) {
    }
}
