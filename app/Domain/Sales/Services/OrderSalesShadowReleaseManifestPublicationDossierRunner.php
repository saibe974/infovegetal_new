<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationDossierRunner
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationDossierBuilder $builder = new OrderSalesShadowReleaseManifestPublicationDossierBuilder(),
        private readonly OrderSalesShadowReleaseManifestPublicationDossierVerifier $verifier = new OrderSalesShadowReleaseManifestPublicationDossierVerifier(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDossierInput $input)
    {
        $dossier = $this->builder->build($input);
        $verification = $this->verifier->verify($dossier);

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDossierResult';

        return new $resultClass(
            dossier: $dossier,
            verification: $verification,
        );
    }
}
