<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleasePipelineRunner
{
    public function __construct(
        private readonly OrderSalesShadowGovernanceEnvelopeBuilder $envelopeBuilder = new OrderSalesShadowGovernanceEnvelopeBuilder(),
        private readonly OrderSalesShadowGovernanceEnvelopeVerifier $envelopeVerifier = new OrderSalesShadowGovernanceEnvelopeVerifier(),
        private readonly OrderSalesShadowGovernanceReleaseAssessor $releaseAssessor = new OrderSalesShadowGovernanceReleaseAssessor(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowReleasePipelineInput $input)
    {
        $envelope = $this->envelopeBuilder->build(
            input: $input->governanceInput,
            packageGeneratedAtUtc: $input->packageGeneratedAtUtc,
            envelopeGeneratedAtUtc: $input->envelopeGeneratedAtUtc,
            checksumAlgorithm: $input->checksumAlgorithm,
        );

        $verification = $this->envelopeVerifier->verify($envelope);
        $releaseDecision = $this->releaseAssessor->assess($verification, $envelope);

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleasePipelineResult';

        return new $resultClass(
            envelope: $envelope,
            verification: $verification,
            releaseDecision: $releaseDecision,
        );
    }
}
