<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleasePipelineInput
{
    public function __construct(
        public OrderSalesShadowGovernanceInput $governanceInput,
        public string $packageGeneratedAtUtc,
        public string $envelopeGeneratedAtUtc,
        public string $checksumAlgorithm = 'sha256',
    ) {
    }
}
