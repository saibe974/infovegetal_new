<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPackageVerifier
{
    /**
     * @return object
     */
    public function verify(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackage $package)
    {
        $errors = [];

        if ($package->checksumAlgorithm !== 'sha256') {
            $errors[] = 'Unsupported checksum algorithm: ' . $package->checksumAlgorithm;
        }

        $decoded = json_decode($package->manifestPipelineJson, true);
        if (!is_array($decoded)) {
            $errors[] = 'manifestPipelineJson is not valid JSON object/array.';
        } elseif ($decoded !== $package->manifestPipelineArray) {
            $errors[] = 'manifestPipelineArray does not match decoded manifestPipelineJson.';
        }

        $expectedChecksum = hash($package->checksumAlgorithm, $package->manifestPipelineJson);
        if (!hash_equals($expectedChecksum, $package->checksum)) {
            $errors[] = 'checksum does not match manifestPipelineJson payload hash.';
        }

        $arrayAction = $package->manifestPipelineArray['manifest']['release_action'] ?? null;
        $objectAction = $package->manifestPipelineResult->manifest->releaseAction;
        if (!is_string($arrayAction) || $arrayAction !== $objectAction) {
            $errors[] = 'release action mismatch between manifestPipelineResult and serialized manifest payload.';
        }

        $arrayVerified = $package->manifestPipelineArray['manifest_verification']['is_valid'] ?? null;
        $objectVerified = $package->manifestPipelineResult->manifestVerification->isValid;
        if (!is_bool($arrayVerified) || $arrayVerified !== $objectVerified) {
            $errors[] = 'manifest verification validity mismatch between object and serialized payload.';
        }

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPackageVerification';

        return new $resultClass(
            isValid: count($errors) === 0,
            expectedChecksum: $expectedChecksum,
            actualChecksum: $package->checksum,
            algorithm: $package->checksumAlgorithm,
            errors: $errors,
        );
    }
}
