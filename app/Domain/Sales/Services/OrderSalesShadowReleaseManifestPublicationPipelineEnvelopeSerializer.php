<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeSerializer
{
    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelope $envelope): array
    {
        return [
            'generated_at_utc' => $envelope->generatedAtUtc,
            'checksum_algorithm' => $envelope->checksumAlgorithm,
            'checksum' => $envelope->checksum,
            'pipeline' => $envelope->pipelineArray,
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelope $envelope): string
    {
        return (string) json_encode(
            $this->toArray($envelope),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
