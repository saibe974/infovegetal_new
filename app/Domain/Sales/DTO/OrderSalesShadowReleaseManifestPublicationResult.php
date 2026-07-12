<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationResult
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPublicationEnvelopeResult $envelopeResult,
        public OrderSalesShadowReleaseManifestPublicationDecision $publicationDecision,
    ) {
    }
}
