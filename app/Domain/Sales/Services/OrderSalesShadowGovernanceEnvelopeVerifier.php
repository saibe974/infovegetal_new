<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowGovernanceEnvelopeVerifier
{
    /**
     * @return object
     */
    public function verify(\App\Domain\Sales\DTO\OrderSalesShadowGovernanceEnvelope $envelope)
    {
        $errors = [];
        $algorithm = strtolower($envelope->checksumAlgorithm);

        if ($algorithm !== 'sha256') {
            $errors[] = 'Unsupported checksum algorithm. Expected sha256.';

            $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceEnvelopeVerification';

            return new $resultClass(
                isValid: false,
                expectedChecksum: '',
                actualChecksum: $envelope->checksum,
                algorithm: $algorithm,
                errors: $errors,
            );
        }

        $expectedChecksum = hash($algorithm, $envelope->package->governanceJson);

        if (!hash_equals($expectedChecksum, $envelope->checksum)) {
            $errors[] = 'Checksum mismatch between envelope and package payload.';
        }

        $decodedJson = json_decode($envelope->package->governanceJson, true);
        if (!is_array($decodedJson)) {
            $errors[] = 'Package governanceJson is not valid JSON object/array.';
        } elseif ($decodedJson !== $envelope->package->governanceArray) {
            $errors[] = 'Package governanceArray does not match decoded governanceJson.';
        }

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceEnvelopeVerification';

        return new $resultClass(
            isValid: count($errors) === 0,
            expectedChecksum: $expectedChecksum,
            actualChecksum: $envelope->checksum,
            algorithm: $algorithm,
            errors: $errors,
        );
    }
}
