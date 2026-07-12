<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResultSerializer
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeSerializer $envelopeSerializer = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeSerializer(),
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerificationSerializer $verificationSerializer = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerificationSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResult $result): array
    {
        return [
            'envelope' => $this->envelopeSerializer->toArray($result->envelope),
            'verification' => $this->verificationSerializer->toArray($result->verification),
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
