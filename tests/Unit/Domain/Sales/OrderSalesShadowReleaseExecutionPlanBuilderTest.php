<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowBatchResult;
use App\Domain\Sales\DTO\OrderSalesShadowGateResult;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceEnvelope;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceEnvelopeVerification;
use App\Domain\Sales\DTO\OrderSalesShadowGovernancePackage;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceReleaseDecision;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceResult;
use App\Domain\Sales\DTO\OrderSalesShadowReleasePipelineResult;
use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\DTO\ShadowModeGateDecision;
use App\Domain\Sales\DTO\ShadowModeRolloutPlan;
use App\Domain\Sales\DTO\ShadowModeRolloutStep;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;

it('builds execution plan for approve_release action', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseExecutionPlanBuilder';
    $builder = new $builderClass();

    $plan = $builder->build(
        pipelineResult: fakePipelineResult('approve_release', true, 'enable_limited_rollout'),
        generatedAtUtc: '2026-07-13T01:40:00Z',
    );

    expect($plan->approved)->toBeTrue()
        ->and($plan->releaseAction)->toBe('approve_release')
        ->and(count($plan->steps))->toBeGreaterThan(2)
        ->and($plan->steps[0]->type)->toBe('rollout');
});

it('builds execution plan for hold_release action', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseExecutionPlanBuilder';
    $builder = new $builderClass();

    $plan = $builder->build(
        pipelineResult: fakePipelineResult('hold_release', false, 'keep_shadow_only'),
        generatedAtUtc: '2026-07-13T01:45:00Z',
    );

    expect($plan->approved)->toBeFalse()
        ->and($plan->releaseAction)->toBe('hold_release')
        ->and(count($plan->steps))->toBe(2)
        ->and($plan->steps[0]->type)->toBe('hold');
});

it('builds execution plan for reject_release action with remediation', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseExecutionPlanBuilder';
    $builder = new $builderClass();

    $plan = $builder->build(
        pipelineResult: fakePipelineResult('reject_release', false, 'block_rollout'),
        generatedAtUtc: '2026-07-13T01:50:00Z',
    );

    expect($plan->approved)->toBeFalse()
        ->and($plan->releaseAction)->toBe('reject_release')
        ->and(count($plan->steps))->toBe(2)
        ->and($plan->steps[1]->type)->toBe('remediation')
        ->and($plan->steps[1]->checks)->toContain('Envelope verification failed.');
});

function fakePipelineResult(string $action, bool $approved, string $rolloutAction): OrderSalesShadowReleasePipelineResult
{
    $governanceResult = new OrderSalesShadowGovernanceResult(
        gateResult: new OrderSalesShadowGateResult(
            batchResult: new OrderSalesShadowBatchResult(
                calculations: [],
                report: new ShadowModeBatchReport(
                    generatedAtUtc: '2026-07-13T01:20:00Z',
                    summary: new ShadowModeBatchSummary(
                        totalOrders: 10,
                        passCount: 10,
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
                action: $rolloutAction,
                approved: $approved,
                reasons: ['Gate policy evaluated.'],
            ),
        ),
        rolloutPlan: new ShadowModeRolloutPlan(
            generatedAtUtc: '2026-07-13T01:25:00Z',
            recommendedAction: $rolloutAction,
            approved: $approved,
            currentBatchOrders: 10,
            steps: [
                new ShadowModeRolloutStep(
                    phase: 'canary',
                    trafficPercent: 10,
                    durationHours: 24,
                    action: $rolloutAction,
                    requiresManualValidation: false,
                    notes: ['Observe metrics.'],
                ),
            ],
        ),
    );

    $governanceArray = [
        'gate' => [
            'gate_decision' => ['action' => $rolloutAction, 'approved' => $approved, 'reasons' => ['Gate policy evaluated.']],
            'batch_report' => ['generated_at_utc' => '2026-07-13T01:20:00Z', 'summary' => [], 'top_issues' => []],
        ],
        'rollout_plan' => ['generated_at_utc' => '2026-07-13T01:25:00Z', 'recommended_action' => $rolloutAction, 'approved' => $approved, 'current_batch_orders' => 10, 'steps' => []],
    ];

    $json = (string) json_encode($governanceArray, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $envelope = new OrderSalesShadowGovernanceEnvelope(
        generatedAtUtc: '2026-07-13T01:30:00Z',
        checksumAlgorithm: 'sha256',
        checksum: hash('sha256', $json),
        package: new OrderSalesShadowGovernancePackage(
            generatedAtUtc: '2026-07-13T01:29:00Z',
            governanceResult: $governanceResult,
            governanceArray: $governanceArray,
            governanceJson: $json,
        ),
    );

    $verification = new OrderSalesShadowGovernanceEnvelopeVerification(
        isValid: $action !== 'reject_release',
        expectedChecksum: $envelope->checksum,
        actualChecksum: $envelope->checksum,
        algorithm: 'sha256',
        errors: $action === 'reject_release' ? ['Envelope verification failed.'] : [],
    );

    $decision = new OrderSalesShadowGovernanceReleaseDecision(
        action: $action,
        approved: $approved,
        integrityVerified: $action !== 'reject_release',
        rolloutAction: $rolloutAction,
        reasons: $action === 'reject_release'
            ? ['Envelope verification failed.', 'Checksum mismatch between envelope and package payload.']
            : ['Envelope integrity verified.'],
    );

    return new OrderSalesShadowReleasePipelineResult(
        envelope: $envelope,
        verification: $verification,
        releaseDecision: $decision,
    );
}
