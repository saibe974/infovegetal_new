<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineSerializer
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationResultSerializer $publicationResultSerializer = new OrderSalesShadowReleaseManifestPublicationResultSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineResult $pipeline): array
    {
        return [
            'generated_at_utc' => $pipeline->generatedAtUtc,
            'publication_result' => $this->publicationResultSerializer->toArray($pipeline->publicationResult),
            'publication_payload' => $pipeline->publicationArray,
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineResult $pipeline): string
    {
        return (string) json_encode(
            $this->toArray($pipeline),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
