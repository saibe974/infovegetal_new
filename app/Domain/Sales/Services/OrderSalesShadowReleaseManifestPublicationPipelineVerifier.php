<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineVerifier
{
    /**
     * @return object
     */
    public function verify(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineResult $pipeline)
    {
        $errors = [];

        $decoded = json_decode($pipeline->publicationJson, true);
        if (!is_array($decoded)) {
            $errors[] = 'publicationJson is not valid JSON object/array.';
        } elseif ($decoded !== $pipeline->publicationArray) {
            $errors[] = 'publicationArray does not match decoded publicationJson.';
        }

        $objectAction = $pipeline->publicationResult->publicationDecision->action;
        $arrayAction = $pipeline->publicationArray['publication_decision']['action'] ?? null;
        if (!is_string($arrayAction) || $arrayAction !== $objectAction) {
            $errors[] = 'publication decision action mismatch between object and serialized payload.';
        }

        $envelopeVerifiedObject = $pipeline->publicationResult->envelopeResult->verification->isValid;
        $envelopeVerifiedArray = $pipeline->publicationArray['envelope_result']['verification']['is_valid'] ?? null;
        if (!is_bool($envelopeVerifiedArray) || $envelopeVerifiedArray !== $envelopeVerifiedObject) {
            $errors[] = 'envelope verification mismatch between object and serialized payload.';
        }

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineVerification';

        return new $resultClass(
            isValid: count($errors) === 0,
            errors: $errors,
        );
    }
}
