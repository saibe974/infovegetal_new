<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowGovernancePackage
{
    public function __construct(
        public string $generatedAtUtc,
        public OrderSalesShadowGovernanceResult $governanceResult,
        public array $governanceArray,
        public string $governanceJson,
    ) {
    }
}
