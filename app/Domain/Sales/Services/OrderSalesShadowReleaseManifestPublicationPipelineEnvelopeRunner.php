<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeRunner
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeBuilder $builder = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeBuilder(),
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerifier $verifier = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerifier(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput $input)
    {
        $envelope = $this->builder->build($input);
        $verification = $this->verifier->verify($envelope);

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResult';

        return new $resultClass(
            envelope: $envelope,
            verification: $verification,
        );
    }
}
