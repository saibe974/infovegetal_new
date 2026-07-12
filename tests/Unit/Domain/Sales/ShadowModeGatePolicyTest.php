<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;
use App\Domain\Sales\Services\ShadowModeGatePolicy;

it('returns block rollout when batch decision is block', function (): void {
    $policy = new ShadowModeGatePolicy();

    $decision = $policy->decide(batchReport(120, ShadowModePromotionDecision::Block));

    expect($decision->approved)->toBeFalse()
        ->and($decision->action)->toBe('block_rollout');
});

it('returns keep shadow only when batch decision is hold', function (): void {
    $policy = new ShadowModeGatePolicy();

    $decision = $policy->decide(batchReport(120, ShadowModePromotionDecision::Hold));

    expect($decision->approved)->toBeFalse()
        ->and($decision->action)->toBe('keep_shadow_only');
});

it('returns keep shadow only when promote decision has too small sample', function (): void {
    $policy = new ShadowModeGatePolicy();

    $decision = $policy->decide(
        report: batchReport(20, ShadowModePromotionDecision::Promote),
        minimumOrdersForLimitedRollout: 50,
        minimumOrdersForGeneralRollout: 500,
    );

    expect($decision->approved)->toBeFalse()
        ->and($decision->action)->toBe('keep_shadow_only');
});

it('returns limited rollout for promote decision with medium sample', function (): void {
    $policy = new ShadowModeGatePolicy();

    $decision = $policy->decide(
        report: batchReport(200, ShadowModePromotionDecision::Promote),
        minimumOrdersForLimitedRollout: 50,
        minimumOrdersForGeneralRollout: 500,
    );

    expect($decision->approved)->toBeTrue()
        ->and($decision->action)->toBe('enable_limited_rollout');
});

it('returns general rollout for promote decision with large sample', function (): void {
    $policy = new ShadowModeGatePolicy();

    $decision = $policy->decide(
        report: batchReport(1200, ShadowModePromotionDecision::Promote),
        minimumOrdersForLimitedRollout: 50,
        minimumOrdersForGeneralRollout: 500,
    );

    expect($decision->approved)->toBeTrue()
        ->and($decision->action)->toBe('enable_general_rollout');
});

function batchReport(int $totalOrders, ShadowModePromotionDecision $promotionDecision): ShadowModeBatchReport
{
    return new ShadowModeBatchReport(
        generatedAtUtc: '2026-07-12T19:00:00Z',
        summary: new ShadowModeBatchSummary(
            totalOrders: $totalOrders,
            passCount: $totalOrders,
            warningCount: 0,
            failCount: 0,
            skippedCount: 0,
            maxDeltaMinor: 0,
            promotionDecision: $promotionDecision,
            sampleFailedOrderIndexes: [],
        ),
        topIssues: [],
    );
}
