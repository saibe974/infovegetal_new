<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationDossier
{
    public function __construct(
        public string $generatedAtUtc,
        public string $checksumAlgorithm,
        public string $checksum,
        public OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResult $governanceResult,
        public OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceVerification $governanceVerification,
        public array $governanceArray,
        public string $governanceJson,
    ) {
    }
}
