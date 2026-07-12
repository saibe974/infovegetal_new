<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResultSerializer
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResultSerializer $envelopeResultSerializer = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResultSerializer(),
        private readonly OrderSalesShadowReleaseManifestPublicationDecisionSerializer $decisionSerializer = new OrderSalesShadowReleaseManifestPublicationDecisionSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResult $result): array
    {
        return [
            'envelope_result' => $this->envelopeResultSerializer->toArray($result->envelopeResult),
            'publication_decision' => $this->decisionSerializer->toArray($result->publicationDecision),
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
