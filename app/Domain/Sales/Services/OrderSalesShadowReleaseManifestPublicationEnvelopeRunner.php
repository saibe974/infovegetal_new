<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationEnvelopeRunner
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationEnvelopeBuilder $builder = new OrderSalesShadowReleaseManifestPublicationEnvelopeBuilder(),
        private readonly OrderSalesShadowReleaseManifestPublicationEnvelopeVerifier $verifier = new OrderSalesShadowReleaseManifestPublicationEnvelopeVerifier(),
    ) {
    }

    /**
     * @return object
     */
    public function run(
        \App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageInput $input,
        string $envelopeGeneratedAtUtc,
        string $checksumAlgorithm = 'sha256',
    ) {
        $envelope = $this->builder->build(
            input: $input,
            envelopeGeneratedAtUtc: $envelopeGeneratedAtUtc,
            checksumAlgorithm: $checksumAlgorithm,
        );

        $verification = $this->verifier->verify($envelope);
        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationEnvelopeResult';

        return new $resultClass(
            envelope: $envelope,
            verification: $verification,
        );
    }
}
