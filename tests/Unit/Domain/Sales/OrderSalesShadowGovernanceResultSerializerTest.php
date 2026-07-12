<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowBatchResult;
use App\Domain\Sales\DTO\OrderSalesShadowGateResult;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceResult;
use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\DTO\ShadowModeGateDecision;
use App\Domain\Sales\DTO\ShadowModeRolloutPlan;
use App\Domain\Sales\DTO\ShadowModeRolloutStep;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;

it('serializes governance result to deterministic array', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceResultSerializer';
    $serializer = new $serializerClass();

    $result = new OrderSalesShadowGovernanceResult(
        gateResult: new OrderSalesShadowGateResult(
            batchResult: new OrderSalesShadowBatchResult(
                calculations: [],
                report: new ShadowModeBatchReport(
                    generatedAtUtc: '2026-07-12T23:00:00Z',
                    summary: new ShadowModeBatchSummary(
                        totalOrders: 12,
                        passCount: 10,
                        warningCount: 2,
                        failCount: 0,
                        skippedCount: 0,
                        maxDeltaMinor: 2,
                        promotionDecision: ShadowModePromotionDecision::Promote,
                        sampleFailedOrderIndexes: [],
                    ),
                    topIssues: [],
                ),
            ),
            gateDecision: new ShadowModeGateDecision(
                action: 'enable_limited_rollout',
                approved: true,
                reasons: ['Policy approved limited rollout.'],
            ),
        ),
        rolloutPlan: new ShadowModeRolloutPlan(
            generatedAtUtc: '2026-07-12T23:05:00Z',
            recommendedAction: 'enable_limited_rollout',
            approved: true,
            currentBatchOrders: 12,
            steps: [
                new ShadowModeRolloutStep(
                    phase: 'canary',
                    trafficPercent: 10,
                    durationHours: 24,
                    action: 'enable_limited_rollout',
                    requiresManualValidation: false,
                    notes: ['Observe key metrics.'],
                ),
                new ShadowModeRolloutStep(
                    phase: 'limited',
                    trafficPercent: 50,
                    durationHours: 24,
                    action: 'enable_limited_rollout',
                    requiresManualValidation: false,
                    notes: ['Keep monitoring.'],
                ),
            ],
        ),
    );

    $array = $serializer->toArray($result);

    expect($array)->toBe([
        'gate' => [
            'gate_decision' => [
                'action' => 'enable_limited_rollout',
                'approved' => true,
                'reasons' => ['Policy approved limited rollout.'],
            ],
            'batch_report' => [
                'generated_at_utc' => '2026-07-12T23:00:00Z',
                'summary' => [
                    'total_orders' => 12,
                    'pass_count' => 10,
                    'warning_count' => 2,
                    'fail_count' => 0,
                    'skipped_count' => 0,
                    'max_delta_minor' => 2,
                    'promotion_decision' => 'promote',
                    'sample_failed_order_indexes' => [],
                ],
                'top_issues' => [],
            ],
        ],
        'rollout_plan' => [
            'generated_at_utc' => '2026-07-12T23:05:00Z',
            'recommended_action' => 'enable_limited_rollout',
            'approved' => true,
            'current_batch_orders' => 12,
            'steps' => [
                [
                    'phase' => 'canary',
                    'traffic_percent' => 10,
                    'duration_hours' => 24,
                    'action' => 'enable_limited_rollout',
                    'requires_manual_validation' => false,
                    'notes' => ['Observe key metrics.'],
                ],
                [
                    'phase' => 'limited',
                    'traffic_percent' => 50,
                    'duration_hours' => 24,
                    'action' => 'enable_limited_rollout',
                    'requires_manual_validation' => false,
                    'notes' => ['Keep monitoring.'],
                ],
            ],
        ],
    ]);
});

it('serializes governance result to valid json', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceResultSerializer';
    $serializer = new $serializerClass();

    $result = new OrderSalesShadowGovernanceResult(
        gateResult: new OrderSalesShadowGateResult(
            batchResult: new OrderSalesShadowBatchResult(
                calculations: [],
                report: new ShadowModeBatchReport(
                    generatedAtUtc: '2026-07-12T23:10:00Z',
                    summary: new ShadowModeBatchSummary(
                        totalOrders: 0,
                        passCount: 0,
                        warningCount: 0,
                        failCount: 0,
                        skippedCount: 0,
                        maxDeltaMinor: 0,
                        promotionDecision: ShadowModePromotionDecision::Promote,
                        sampleFailedOrderIndexes: [],
                    ),
                    topIssues: [],
                ),
            ),
            gateDecision: new ShadowModeGateDecision(
                action: 'keep_shadow_only',
                approved: false,
                reasons: ['Insufficient sample size.'],
            ),
        ),
        rolloutPlan: new ShadowModeRolloutPlan(
            generatedAtUtc: '2026-07-12T23:11:00Z',
            recommendedAction: 'keep_shadow_only',
            approved: false,
            currentBatchOrders: 0,
            steps: [
                new ShadowModeRolloutStep(
                    phase: 'shadow_only',
                    trafficPercent: 0,
                    durationHours: 24,
                    action: 'monitor_only',
                    requiresManualValidation: true,
                    notes: ['Continue monitoring in shadow mode.'],
                ),
            ],
        ),
    );

    $json = $serializer->toJson($result);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['gate']['gate_decision']['action'])->toBe('keep_shadow_only')
        ->and($decoded['rollout_plan']['recommended_action'])->toBe('keep_shadow_only')
        ->and($decoded['rollout_plan']['steps'][0]['phase'])->toBe('shadow_only');
});
