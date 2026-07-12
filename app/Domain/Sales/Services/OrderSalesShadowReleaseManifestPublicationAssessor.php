<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationAssessor
{
    /**
     * @return object
     */
    public function assess(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageResult $result)
    {
        $reasons = [];
        $releaseAction = (string) $result->package->manifestPipelineResult->manifest->releaseAction;

        if (!$result->verification->isValid) {
            $reasons[] = 'Manifest package verification failed.';
            foreach ($result->verification->errors as $error) {
                $reasons[] = (string) $error;
            }

            $decisionClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDecision';

            return new $decisionClass(
                action: 'reject_manifest_publication',
                approved: false,
                integrityVerified: false,
                releaseAction: $releaseAction,
                reasons: $reasons,
            );
        }

        $reasons[] = 'Manifest package integrity verified.';

        if ($releaseAction === 'reject_release') {
            $reasons[] = 'Release action is reject_release.';

            $decisionClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDecision';

            return new $decisionClass(
                action: 'reject_manifest_publication',
                approved: false,
                integrityVerified: true,
                releaseAction: $releaseAction,
                reasons: $reasons,
            );
        }

        if ($releaseAction === 'hold_release') {
            $reasons[] = 'Release action is hold_release; keep manifest internal.';

            $decisionClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDecision';

            return new $decisionClass(
                action: 'hold_manifest_publication',
                approved: false,
                integrityVerified: true,
                releaseAction: $releaseAction,
                reasons: $reasons,
            );
        }

        $reasons[] = 'Release action is approve_release.';

        $decisionClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDecision';

        return new $decisionClass(
            action: 'publish_manifest',
            approved: true,
            integrityVerified: true,
            releaseAction: $releaseAction,
            reasons: $reasons,
        );
    }
}
