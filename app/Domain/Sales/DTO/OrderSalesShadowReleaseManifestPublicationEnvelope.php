<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationEnvelope
{
    public function __construct(
        public string $generatedAtUtc,
        public string $checksumAlgorithm,
        public string $checksum,
        public OrderSalesShadowReleaseManifestPackageGovernanceResult $governanceResult,
        public array $governanceArray,
        public string $governanceJson,
    ) {
    }
}
