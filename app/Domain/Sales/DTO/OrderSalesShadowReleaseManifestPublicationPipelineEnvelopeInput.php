<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPublicationPipelineInput $pipelineInput,
        public string $envelopeGeneratedAtUtc,
        public string $checksumAlgorithm = 'sha256',
    ) {
    }
}
