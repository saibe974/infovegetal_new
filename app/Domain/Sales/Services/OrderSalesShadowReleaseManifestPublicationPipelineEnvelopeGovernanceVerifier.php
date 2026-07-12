<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceVerifier
{
    /**
     * @return object
     */
    public function verify(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResult $result)
    {
        $errors = [];

        $envelopeVerifiedObject = $result->envelopeResult->verification->isValid;
        $decisionIntegrityObject = $result->publicationDecision->integrityVerified;

        if ($decisionIntegrityObject !== $envelopeVerifiedObject) {
            $errors[] = 'integrityVerified mismatch between publication decision and envelope verification.';
        }

        $decisionAction = $result->publicationDecision->action;
        $envelopeAction = $result->envelopeResult->envelope->pipelineResult->publicationResult->publicationDecision->action;

        if ($envelopeVerifiedObject && $decisionAction !== $envelopeAction) {
            $errors[] = 'publication decision action mismatch when envelope verification is valid.';
        }

        if (!$envelopeVerifiedObject && $decisionAction !== 'reject_manifest_publication') {
            $errors[] = 'invalid envelope verification must force reject_manifest_publication action.';
        }

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceVerification';

        return new $resultClass(
            isValid: count($errors) === 0,
            errors: $errors,
        );
    }
}
