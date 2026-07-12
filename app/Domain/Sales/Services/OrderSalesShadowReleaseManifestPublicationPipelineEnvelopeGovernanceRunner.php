<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceRunner
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeRunner $envelopeRunner = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeRunner(),
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceAssessor $assessor = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceAssessor(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput $input)
    {
        $envelopeResult = $this->envelopeRunner->run($input);
        $publicationDecision = $this->assessor->assess($envelopeResult);

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResult';

        return new $resultClass(
            envelopeResult: $envelopeResult,
            publicationDecision: $publicationDecision,
        );
    }
}
