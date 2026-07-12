<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPackageGovernanceResultSerializer
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPackageResultSerializer $packageResultSerializer = new OrderSalesShadowReleaseManifestPackageResultSerializer(),
        private readonly OrderSalesShadowReleaseManifestPublicationDecisionSerializer $decisionSerializer = new OrderSalesShadowReleaseManifestPublicationDecisionSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageGovernanceResult $result): array
    {
        return [
            'package_result' => $this->packageResultSerializer->toArray($result->packageResult),
            'publication_decision' => $this->decisionSerializer->toArray($result->publicationDecision),
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageGovernanceResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
