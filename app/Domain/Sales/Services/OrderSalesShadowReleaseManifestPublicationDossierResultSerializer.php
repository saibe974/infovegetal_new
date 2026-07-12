<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationDossierResultSerializer
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationDossierSerializer $dossierSerializer = new OrderSalesShadowReleaseManifestPublicationDossierSerializer(),
        private readonly OrderSalesShadowReleaseManifestPublicationDossierVerificationSerializer $verificationSerializer = new OrderSalesShadowReleaseManifestPublicationDossierVerificationSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDossierResult $result): array
    {
        return [
            'dossier' => $this->dossierSerializer->toArray($result->dossier),
            'verification' => $this->verificationSerializer->toArray($result->verification),
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDossierResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
