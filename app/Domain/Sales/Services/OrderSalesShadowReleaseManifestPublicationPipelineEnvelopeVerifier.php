<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerifier
{
    /**
     * @return object
     */
    public function verify(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelope $envelope)
    {
        $errors = [];
        $algorithm = strtolower($envelope->checksumAlgorithm);

        if ($algorithm !== 'sha256') {
            $errors[] = 'Unsupported checksum algorithm. Expected sha256.';

            $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerification';

            return new $resultClass(
                isValid: false,
                expectedChecksum: '',
                actualChecksum: $envelope->checksum,
                algorithm: $algorithm,
                errors: $errors,
            );
        }

        $expectedChecksum = hash($algorithm, $envelope->pipelineJson);

        if (!hash_equals($expectedChecksum, $envelope->checksum)) {
            $errors[] = 'Checksum mismatch between publication pipeline envelope and pipeline payload.';
        }

        $decodedJson = json_decode($envelope->pipelineJson, true);
        if (!is_array($decodedJson)) {
            $errors[] = 'pipelineJson is not valid JSON object/array.';
        } elseif ($decodedJson !== $envelope->pipelineArray) {
            $errors[] = 'pipelineArray does not match decoded pipelineJson.';
        }

        $arrayAction = $envelope->pipelineArray['publication_result']['publication_decision']['action'] ?? null;
        $objectAction = $envelope->pipelineResult->publicationResult->publicationDecision->action;
        if (!is_string($arrayAction) || $arrayAction !== $objectAction) {
            $errors[] = 'publication decision action mismatch between object and serialized pipeline payload.';
        }

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerification';

        return new $resultClass(
            isValid: count($errors) === 0,
            expectedChecksum: $expectedChecksum,
            actualChecksum: $envelope->checksum,
            algorithm: $algorithm,
            errors: $errors,
        );
    }
}
