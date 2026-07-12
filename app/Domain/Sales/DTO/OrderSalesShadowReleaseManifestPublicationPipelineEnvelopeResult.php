<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResult
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPublicationPipelineEnvelope $envelope,
        public OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerification $verification,
    ) {
    }
}
