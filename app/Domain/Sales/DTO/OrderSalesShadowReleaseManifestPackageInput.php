<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPackageInput
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPipelineInput $manifestPipelineInput,
        public string $packageGeneratedAtUtc,
        public string $checksumAlgorithm = 'sha256',
    ) {
    }
}
