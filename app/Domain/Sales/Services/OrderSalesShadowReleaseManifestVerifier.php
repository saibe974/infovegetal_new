<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestVerifier
{
    /**
     * @return object
     */
    public function verify(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifest $manifest)
    {
        $errors = [];

        $canonical = [
            'schema_version' => $manifest->schemaVersion,
            'payload' => $manifest->payload,
        ];

        $expectedManifestId = hash(
            'sha256',
            (string) json_encode($canonical, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );

        if (!hash_equals($expectedManifestId, $manifest->manifestId)) {
            $errors[] = 'manifestId does not match canonical payload hash.';
        }

        if (($manifest->payload['readiness_report']['status'] ?? null) !== $manifest->status) {
            $errors[] = 'status mismatch between manifest header and payload readiness report.';
        }

        if (($manifest->payload['readiness_report']['release_action'] ?? null) !== $manifest->releaseAction) {
            $errors[] = 'releaseAction mismatch between manifest header and payload readiness report.';
        }

        if (($manifest->payload['readiness_report']['approved'] ?? null) !== $manifest->approved) {
            $errors[] = 'approved mismatch between manifest header and payload readiness report.';
        }

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestVerification';

        return new $resultClass(
            isValid: count($errors) === 0,
            expectedManifestId: $expectedManifestId,
            actualManifestId: $manifest->manifestId,
            errors: $errors,
        );
    }
}
