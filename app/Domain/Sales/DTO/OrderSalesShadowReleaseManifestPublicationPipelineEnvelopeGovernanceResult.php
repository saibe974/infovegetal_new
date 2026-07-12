<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResult
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResult $envelopeResult,
        public OrderSalesShadowReleaseManifestPublicationDecision $publicationDecision,
    ) {
    }
}
