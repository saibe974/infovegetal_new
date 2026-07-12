<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleasePipelineResult
{
    public function __construct(
        public OrderSalesShadowGovernanceEnvelope $envelope,
        public OrderSalesShadowGovernanceEnvelopeVerification $verification,
        public OrderSalesShadowGovernanceReleaseDecision $releaseDecision,
    ) {
    }
}
