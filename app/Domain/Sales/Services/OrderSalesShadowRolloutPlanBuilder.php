<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowRolloutPlanBuilder
{
    /**
     * @return object
     */
    public function build(
        \App\Domain\Sales\DTO\OrderSalesShadowGateResult $result,
        string $generatedAtUtc,
        int $limitedStartPercent = 10,
        int $limitedEndPercent = 50,
        int $hoursPerStep = 24,
    ) {
        if ($limitedStartPercent < 0 || $limitedStartPercent > 100) {
            throw new \InvalidArgumentException('limitedStartPercent must be between 0 and 100.');
        }

        if ($limitedEndPercent < 0 || $limitedEndPercent > 100) {
            throw new \InvalidArgumentException('limitedEndPercent must be between 0 and 100.');
        }

        if ($limitedStartPercent > $limitedEndPercent) {
            throw new \InvalidArgumentException('limitedStartPercent must be <= limitedEndPercent.');
        }

        if ($hoursPerStep <= 0) {
            throw new \InvalidArgumentException('hoursPerStep must be > 0.');
        }

        $action = is_object($result->gateDecision->action)
            ? $result->gateDecision->action->value
            : (string) $result->gateDecision->action;

        $notes = array_values($result->gateDecision->reasons);
        $steps = [];

        if ($action === 'block_rollout' || $action === 'keep_shadow_only') {
            $stepClass = 'App\\Domain\\Sales\\DTO\\ShadowModeRolloutStep';
            $steps[] = new $stepClass(
                phase: 'shadow_only',
                trafficPercent: 0,
                durationHours: $hoursPerStep,
                action: 'monitor_only',
                requiresManualValidation: true,
                notes: $notes,
            );
        } elseif ($action === 'enable_limited_rollout') {
            $stepClass = 'App\\Domain\\Sales\\DTO\\ShadowModeRolloutStep';
            $steps[] = new $stepClass(
                phase: 'canary',
                trafficPercent: $limitedStartPercent,
                durationHours: $hoursPerStep,
                action: 'enable_limited_rollout',
                requiresManualValidation: false,
                notes: $notes,
            );
            $steps[] = new $stepClass(
                phase: 'limited',
                trafficPercent: $limitedEndPercent,
                durationHours: $hoursPerStep,
                action: 'enable_limited_rollout',
                requiresManualValidation: false,
                notes: $notes,
            );
            $steps[] = new $stepClass(
                phase: 'review',
                trafficPercent: $limitedEndPercent,
                durationHours: $hoursPerStep,
                action: 'keep_shadow_only',
                requiresManualValidation: true,
                notes: ['Validate metrics before general rollout.'],
            );
        } else {
            $stepClass = 'App\\Domain\\Sales\\DTO\\ShadowModeRolloutStep';
            $steps[] = new $stepClass(
                phase: 'canary',
                trafficPercent: $limitedStartPercent,
                durationHours: $hoursPerStep,
                action: 'enable_limited_rollout',
                requiresManualValidation: false,
                notes: $notes,
            );
            $steps[] = new $stepClass(
                phase: 'ramp',
                trafficPercent: $limitedEndPercent,
                durationHours: $hoursPerStep,
                action: 'enable_limited_rollout',
                requiresManualValidation: false,
                notes: $notes,
            );
            $steps[] = new $stepClass(
                phase: 'general',
                trafficPercent: 100,
                durationHours: $hoursPerStep,
                action: 'enable_general_rollout',
                requiresManualValidation: false,
                notes: ['General rollout approved by gate policy.'],
            );
        }

        $planClass = 'App\\Domain\\Sales\\DTO\\ShadowModeRolloutPlan';

        return new $planClass(
            generatedAtUtc: $generatedAtUtc,
            recommendedAction: $action,
            approved: $result->gateDecision->approved,
            currentBatchOrders: $result->batchResult->report->summary->totalOrders,
            steps: $steps,
        );
    }
}
