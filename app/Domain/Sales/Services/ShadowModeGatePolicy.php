<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\Enums\ShadowModePromotionDecision;

final class ShadowModeGatePolicy
{
    public function decide(
        \App\Domain\Sales\DTO\ShadowModeBatchReport $report,
        int $minimumOrdersForLimitedRollout = 50,
        int $minimumOrdersForGeneralRollout = 500,
    ) {
        if ($minimumOrdersForLimitedRollout < 0 || $minimumOrdersForGeneralRollout < 0) {
            throw new \InvalidArgumentException('Minimum order thresholds must be >= 0.');
        }

        $reasons = [];
        $summary = $report->summary;
        $decision = $summary->promotionDecision;

        if (!$decision instanceof ShadowModePromotionDecision) {
            $reasons[] = 'Batch promotion decision is not typed as expected.';

            return new \App\Domain\Sales\DTO\ShadowModeGateDecision(
                action: 'keep_shadow_only',
                approved: false,
                reasons: $reasons,
            );
        }

        if ($decision === ShadowModePromotionDecision::Block) {
            $reasons[] = 'Batch decision is BLOCK because at least one fail exists.';
            $reasons[] = 'Rollout must be blocked until diffs are fixed.';

            return new \App\Domain\Sales\DTO\ShadowModeGateDecision(
                action: 'block_rollout',
                approved: false,
                reasons: $reasons,
            );
        }

        if ($decision === ShadowModePromotionDecision::Hold) {
            $reasons[] = 'Batch decision is HOLD: warning/skipped rates are above policy thresholds.';

            return new \App\Domain\Sales\DTO\ShadowModeGateDecision(
                action: 'keep_shadow_only',
                approved: false,
                reasons: $reasons,
            );
        }

        // PromotionDecision::Promote
        if ($summary->totalOrders < $minimumOrdersForLimitedRollout) {
            $reasons[] = 'Promote decision reached, but sample size is too small for rollout.';

            return new \App\Domain\Sales\DTO\ShadowModeGateDecision(
                action: 'keep_shadow_only',
                approved: false,
                reasons: $reasons,
            );
        }

        if ($summary->totalOrders < $minimumOrdersForGeneralRollout) {
            $reasons[] = 'Promote decision reached with sufficient sample for limited rollout.';
            $reasons[] = 'Keep monitoring during controlled exposure.';

            return new \App\Domain\Sales\DTO\ShadowModeGateDecision(
                action: 'enable_limited_rollout',
                approved: true,
                reasons: $reasons,
            );
        }

        $reasons[] = 'Promote decision reached with strong sample size.';
        $reasons[] = 'General rollout can be enabled with standard monitoring.';

        return new \App\Domain\Sales\DTO\ShadowModeGateDecision(
            action: 'enable_general_rollout',
            approved: true,
            reasons: $reasons,
        );
    }
}
