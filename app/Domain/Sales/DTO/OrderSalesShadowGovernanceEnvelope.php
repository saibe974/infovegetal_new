<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowGovernanceEnvelope
{
    public function __construct(
        public string $generatedAtUtc,
        public string $checksumAlgorithm,
        public string $checksum,
        public OrderSalesShadowGovernancePackage $package,
    ) {
    }
}
