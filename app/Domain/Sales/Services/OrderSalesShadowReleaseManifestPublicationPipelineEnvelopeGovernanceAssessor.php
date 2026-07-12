<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceAssessor
{
    /**
     * @return object
     */
    public function assess(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResult $result)
    {
        $currentDecision = $result->envelope->pipelineResult->publicationResult->publicationDecision;

        if ($result->verification->isValid) {
            return $currentDecision;
        }

        $decisionClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDecision';

        return new $decisionClass(
            action: 'reject_manifest_publication',
            approved: false,
            integrityVerified: false,
            releaseAction: $currentDecision->releaseAction,
            reasons: array_values(array_merge(
                ['Publication pipeline envelope verification failed.'],
                $result->verification->errors,
            )),
        );
    }
}
