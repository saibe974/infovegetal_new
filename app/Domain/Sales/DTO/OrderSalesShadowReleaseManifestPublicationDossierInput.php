<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationDossierInput
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput $governanceInput,
        public string $dossierGeneratedAtUtc,
        public string $checksumAlgorithm = 'sha256',
    ) {
    }
}
