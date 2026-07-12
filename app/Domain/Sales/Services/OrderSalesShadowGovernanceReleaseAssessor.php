<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowGovernanceReleaseAssessor
{
    /**
     * @return object
     */
    public function assess(
        \App\Domain\Sales\DTO\OrderSalesShadowGovernanceEnvelopeVerification $verification,
        \App\Domain\Sales\DTO\OrderSalesShadowGovernanceEnvelope $envelope,
    ) {
        $reasons = [];
        $rolloutAction = (string) $envelope->package->governanceResult->gateResult->gateDecision->action;

        if (!$verification->isValid) {
            $reasons[] = 'Envelope verification failed.';
            foreach ($verification->errors as $error) {
                $reasons[] = (string) $error;
            }

            $decisionClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceReleaseDecision';

            return new $decisionClass(
                action: 'reject_release',
                approved: false,
                integrityVerified: false,
                rolloutAction: $rolloutAction,
                reasons: $reasons,
            );
        }

        $reasons[] = 'Envelope integrity verified.';

        if ($rolloutAction === 'block_rollout') {
            $reasons[] = 'Gate action is block_rollout.';

            $decisionClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceReleaseDecision';

            return new $decisionClass(
                action: 'reject_release',
                approved: false,
                integrityVerified: true,
                rolloutAction: $rolloutAction,
                reasons: $reasons,
            );
        }

        if ($rolloutAction === 'keep_shadow_only') {
            $reasons[] = 'Gate action is keep_shadow_only; continue monitoring without release.';

            $decisionClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceReleaseDecision';

            return new $decisionClass(
                action: 'hold_release',
                approved: false,
                integrityVerified: true,
                rolloutAction: $rolloutAction,
                reasons: $reasons,
            );
        }

        $reasons[] = 'Gate action allows rollout.';

        $decisionClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceReleaseDecision';

        return new $decisionClass(
            action: 'approve_release',
            approved: true,
            integrityVerified: true,
            rolloutAction: $rolloutAction,
            reasons: $reasons,
        );
    }
}
