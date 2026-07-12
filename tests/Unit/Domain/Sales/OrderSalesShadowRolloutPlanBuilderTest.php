<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowBatchResult;
use App\Domain\Sales\DTO\OrderSalesShadowGateResult;
use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\DTO\ShadowModeGateDecision;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;

it('builds shadow-only plan when rollout is not approved', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowRolloutPlanBuilder';
    $builder = new $builderClass();

    $plan = $builder->build(
        result: fakeGateResult('keep_shadow_only', false, 120),
        generatedAtUtc: '2026-07-12T21:00:00Z',
    );

    expect($plan->approved)->toBeFalse()
        ->and($plan->recommendedAction)->toBe('keep_shadow_only')
        ->and(count($plan->steps))->toBe(1)
        ->and($plan->steps[0]->phase)->toBe('shadow_only')
        ->and($plan->steps[0]->trafficPercent)->toBe(0);
});

it('builds limited rollout plan with review phase', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowRolloutPlanBuilder';
    $builder = new $builderClass();

    $plan = $builder->build(
        result: fakeGateResult('enable_limited_rollout', true, 250),
        generatedAtUtc: '2026-07-12T21:05:00Z',
        limitedStartPercent: 10,
        limitedEndPercent: 50,
        hoursPerStep: 12,
    );

    expect($plan->approved)->toBeTrue()
        ->and($plan->currentBatchOrders)->toBe(250)
        ->and(count($plan->steps))->toBe(3)
        ->and($plan->steps[0]->trafficPercent)->toBe(10)
        ->and($plan->steps[1]->trafficPercent)->toBe(50)
        ->and($plan->steps[2]->requiresManualValidation)->toBeTrue();
});

it('builds general rollout plan ending at 100 percent', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowRolloutPlanBuilder';
    $builder = new $builderClass();

    $plan = $builder->build(
        result: fakeGateResult('enable_general_rollout', true, 1200),
        generatedAtUtc: '2026-07-12T21:10:00Z',
        limitedStartPercent: 5,
        limitedEndPercent: 40,
    );

    expect($plan->approved)->toBeTrue()
        ->and($plan->recommendedAction)->toBe('enable_general_rollout')
        ->and(count($plan->steps))->toBe(3)
        ->and($plan->steps[2]->phase)->toBe('general')
        ->and($plan->steps[2]->trafficPercent)->toBe(100);
});

function fakeGateResult(string $action, bool $approved, int $totalOrders): OrderSalesShadowGateResult
{
    return new OrderSalesShadowGateResult(
        batchResult: new OrderSalesShadowBatchResult(
            calculations: [],
            report: new ShadowModeBatchReport(
                generatedAtUtc: '2026-07-12T21:00:00Z',
                summary: new ShadowModeBatchSummary(
                    totalOrders: $totalOrders,
                    passCount: $totalOrders,
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
            action: $action,
            approved: $approved,
            reasons: ['Gate policy evaluated.'],
        ),
    );
}
