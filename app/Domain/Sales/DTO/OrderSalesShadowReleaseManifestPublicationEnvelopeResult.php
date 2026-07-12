<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationEnvelopeResult
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPublicationEnvelope $envelope,
        public OrderSalesShadowReleaseManifestPublicationEnvelopeVerification $verification,
    ) {
    }
}
