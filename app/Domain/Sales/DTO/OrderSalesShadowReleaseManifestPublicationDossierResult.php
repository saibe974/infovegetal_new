<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationDossierResult
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPublicationDossier $dossier,
        public OrderSalesShadowReleaseManifestPublicationDossierVerification $verification,
    ) {
    }
}
