<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationPipelineInput
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPackageInput $packageInput,
        public string $envelopeGeneratedAtUtc,
        public string $pipelineGeneratedAtUtc,
        public string $checksumAlgorithm = 'sha256',
    ) {
    }
}
