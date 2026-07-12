<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseExecutionPlanBuilder
{
    /**
     * @return object
     */
    public function build(
        \App\Domain\Sales\DTO\OrderSalesShadowReleasePipelineResult $pipelineResult,
        string $generatedAtUtc,
    ) {
        $decision = $pipelineResult->releaseDecision;
        $steps = [];
        $summary = '';
        $index = 1;

        $stepClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseExecutionStep';

        if ($decision->action === 'approve_release') {
            $summary = 'Release is approved with validated integrity and rollout action.';

            $steps[] = new $stepClass(
                order: $index++,
                title: 'Publish rollout configuration',
                type: 'rollout',
                mandatory: true,
                checks: [
                    'Apply rollout action: ' . $decision->rolloutAction,
                    'Record envelope checksum in release log',
                ],
            );

            foreach ($pipelineResult->envelope->package->governanceResult->rolloutPlan->steps as $planStep) {
                $steps[] = new $stepClass(
                    order: $index++,
                    title: 'Execute phase: ' . $planStep->phase,
                    type: 'phase',
                    mandatory: true,
                    checks: [
                        'Traffic percent: ' . $planStep->trafficPercent,
                        'Duration hours: ' . $planStep->durationHours,
                        'Action: ' . $planStep->action,
                    ],
                );
            }

            $steps[] = new $stepClass(
                order: $index++,
                title: 'Post-release verification',
                type: 'verification',
                mandatory: true,
                checks: [
                    'Verify key metrics after release phases',
                    'Confirm no integrity drift from envelope checksum',
                ],
            );
        } elseif ($decision->action === 'hold_release') {
            $summary = 'Release is on hold; continue in shadow mode and monitoring.';

            $steps[] = new $stepClass(
                order: $index++,
                title: 'Keep shadow-only mode',
                type: 'hold',
                mandatory: true,
                checks: [
                    'Do not enable production rollout',
                    'Continue collecting shadow comparisons',
                ],
            );

            $steps[] = new $stepClass(
                order: $index++,
                title: 'Schedule next gate review',
                type: 'review',
                mandatory: true,
                checks: [
                    'Define next batch sample target',
                    'Review warning and skipped rates',
                ],
            );
        } else {
            $summary = 'Release is rejected until integrity and/or gate issues are resolved.';

            $steps[] = new $stepClass(
                order: $index++,
                title: 'Block release',
                type: 'reject',
                mandatory: true,
                checks: [
                    'Prevent rollout deployment',
                    'Open incident for failed checks',
                ],
            );

            $checks = [];
            foreach ($decision->reasons as $reason) {
                $checks[] = (string) $reason;
            }

            $steps[] = new $stepClass(
                order: $index++,
                title: 'Remediation checklist',
                type: 'remediation',
                mandatory: true,
                checks: $checks,
            );
        }

        $planClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseExecutionPlan';

        return new $planClass(
            generatedAtUtc: $generatedAtUtc,
            releaseAction: $decision->action,
            approved: $decision->approved,
            summary: $summary,
            steps: $steps,
        );
    }
}
