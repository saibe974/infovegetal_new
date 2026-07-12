<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationEnvelopeVerifier
{
    /**
     * @return object
     */
    public function verify(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationEnvelope $envelope)
    {
        $errors = [];
        $algorithm = strtolower($envelope->checksumAlgorithm);

        if ($algorithm !== 'sha256') {
            $errors[] = 'Unsupported checksum algorithm. Expected sha256.';

            $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationEnvelopeVerification';

            return new $resultClass(
                isValid: false,
                expectedChecksum: '',
                actualChecksum: $envelope->checksum,
                algorithm: $algorithm,
                errors: $errors,
            );
        }

        $expectedChecksum = hash($algorithm, $envelope->governanceJson);

        if (!hash_equals($expectedChecksum, $envelope->checksum)) {
            $errors[] = 'Checksum mismatch between publication envelope and governance payload.';
        }

        $decodedJson = json_decode($envelope->governanceJson, true);
        if (!is_array($decodedJson)) {
            $errors[] = 'governanceJson is not valid JSON object/array.';
        } elseif ($decodedJson !== $envelope->governanceArray) {
            $errors[] = 'governanceArray does not match decoded governanceJson.';
        }

        $arrayAction = $envelope->governanceArray['publication_decision']['action'] ?? null;
        $objectAction = $envelope->governanceResult->publicationDecision->action;
        if (!is_string($arrayAction) || $arrayAction !== $objectAction) {
            $errors[] = 'publication decision action mismatch between object and serialized payload.';
        }

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationEnvelopeVerification';

        return new $resultClass(
            isValid: count($errors) === 0,
            expectedChecksum: $expectedChecksum,
            actualChecksum: $envelope->checksum,
            algorithm: $algorithm,
            errors: $errors,
        );
    }
}
