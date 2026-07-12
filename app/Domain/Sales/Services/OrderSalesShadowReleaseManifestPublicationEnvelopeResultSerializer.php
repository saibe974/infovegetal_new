<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationEnvelopeResultSerializer
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationEnvelopeSerializer $envelopeSerializer = new OrderSalesShadowReleaseManifestPublicationEnvelopeSerializer(),
        private readonly OrderSalesShadowReleaseManifestPublicationEnvelopeVerificationSerializer $verificationSerializer = new OrderSalesShadowReleaseManifestPublicationEnvelopeVerificationSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationEnvelopeResult $result): array
    {
        return [
            'envelope' => $this->envelopeSerializer->toArray($result->envelope),
            'verification' => $this->verificationSerializer->toArray($result->verification),
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationEnvelopeResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
