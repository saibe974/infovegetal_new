<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPipelineResultSerializer
{
    public function __construct(
        private readonly OrderSalesShadowReleaseReadinessResultSerializer $readinessSerializer = new OrderSalesShadowReleaseReadinessResultSerializer(),
        private readonly OrderSalesShadowReleaseManifestSerializer $manifestSerializer = new OrderSalesShadowReleaseManifestSerializer(),
        private readonly OrderSalesShadowReleaseManifestVerificationSerializer $manifestVerificationSerializer = new OrderSalesShadowReleaseManifestVerificationSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPipelineResult $result): array
    {
        return [
            'readiness' => $this->readinessSerializer->toArray($result->readinessResult),
            'manifest' => $this->manifestSerializer->toArray($result->manifest),
            'manifest_verification' => $this->manifestVerificationSerializer->toArray($result->manifestVerification),
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPipelineResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
