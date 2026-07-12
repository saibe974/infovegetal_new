<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationDossierSerializer
{
    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDossier $dossier): array
    {
        return [
            'generated_at_utc' => $dossier->generatedAtUtc,
            'checksum_algorithm' => $dossier->checksumAlgorithm,
            'checksum' => $dossier->checksum,
            'governance' => $dossier->governanceArray,
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDossier $dossier): string
    {
        return (string) json_encode(
            $this->toArray($dossier),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
