<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowBatchResult;
use App\Domain\Sales\DTO\OrderSalesShadowGateResult;
use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\DTO\ShadowModeGateDecision;
use App\Domain\Sales\DTO\ShadowModeOrderIssue;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;
use App\Domain\Sales\Enums\ShadowModeStatus;

it('serializes gate result to deterministic array', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGateResultSerializer';
    $serializer = new $serializerClass();

    $result = new OrderSalesShadowGateResult(
        batchResult: new OrderSalesShadowBatchResult(
            calculations: [],
            report: new ShadowModeBatchReport(
                generatedAtUtc: '2026-07-12T20:00:00Z',
                summary: new ShadowModeBatchSummary(
                    totalOrders: 3,
                    passCount: 2,
                    warningCount: 1,
                    failCount: 0,
                    skippedCount: 0,
                    maxDeltaMinor: 2,
                    promotionDecision: ShadowModePromotionDecision::Promote,
                    sampleFailedOrderIndexes: [],
                ),
                topIssues: [
                    new ShadowModeOrderIssue(
                        orderIndex: 5,
                        status: ShadowModeStatus::Warning,
                        differencesCount: 2,
                        maxDeltaMinor: 2,
                        sampleDifferenceKeys: ['order:total_ht'],
                    ),
                ],
            ),
        ),
        gateDecision: new ShadowModeGateDecision(
            action: 'enable_limited_rollout',
            approved: true,
            reasons: ['Promote decision reached with sufficient sample for limited rollout.'],
        ),
    );

    $array = $serializer->toArray($result);

    expect($array)->toBe([
        'gate_decision' => [
            'action' => 'enable_limited_rollout',
            'approved' => true,
            'reasons' => ['Promote decision reached with sufficient sample for limited rollout.'],
        ],
        'batch_report' => [
            'generated_at_utc' => '2026-07-12T20:00:00Z',
            'summary' => [
                'total_orders' => 3,
                'pass_count' => 2,
                'warning_count' => 1,
                'fail_count' => 0,
                'skipped_count' => 0,
                'max_delta_minor' => 2,
                'promotion_decision' => 'promote',
                'sample_failed_order_indexes' => [],
            ],
            'top_issues' => [
                [
                    'order_index' => 5,
                    'status' => 'warning',
                    'differences_count' => 2,
                    'max_delta_minor' => 2,
                    'sample_difference_keys' => ['order:total_ht'],
                ],
            ],
        ],
    ]);
});

it('serializes gate result to valid json', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGateResultSerializer';
    $serializer = new $serializerClass();

    $result = new OrderSalesShadowGateResult(
        batchResult: new OrderSalesShadowBatchResult(
            calculations: [],
            report: new ShadowModeBatchReport(
                generatedAtUtc: '2026-07-12T20:05:00Z',
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
    );

    $json = $serializer->toJson($result);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['gate_decision']['action'])->toBe('keep_shadow_only')
        ->and($decoded['gate_decision']['approved'])->toBeFalse()
        ->and($decoded['batch_report']['generated_at_utc'])->toBe('2026-07-12T20:05:00Z');
});
