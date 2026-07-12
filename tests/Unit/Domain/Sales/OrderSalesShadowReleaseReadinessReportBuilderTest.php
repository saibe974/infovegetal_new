<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowBatchResult;
use App\Domain\Sales\DTO\OrderSalesShadowGateResult;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceEnvelope;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceEnvelopeVerification;
use App\Domain\Sales\DTO\OrderSalesShadowGovernancePackage;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceReleaseDecision;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceResult;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionPackage;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionPackageVerification;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionPlan;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionStep;
use App\Domain\Sales\DTO\OrderSalesShadowReleasePipelineResult;
use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\DTO\ShadowModeGateDecision;
use App\Domain\Sales\DTO\ShadowModeRolloutPlan;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;

it('builds ready report when verification is valid and action is approve_release', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseReadinessReportBuilder';
    $builder = new $builderClass();

    $package = fakeExecutionPackage('approve_release');
    $verification = new OrderSalesShadowReleaseExecutionPackageVerification(true, []);

    $report = $builder->build($package, $verification, '2026-07-13T03:00:00Z');

    expect($report->status)->toBe('ready')
        ->and($report->integrityValid)->toBeTrue()
        ->and($report->blockingIssues)->toBe([])
        ->and($report->requiredSteps)->toBe(2);
});

it('builds hold report when action is hold_release', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseReadinessReportBuilder';
    $builder = new $builderClass();

    $package = fakeExecutionPackage('hold_release');
    $verification = new OrderSalesShadowReleaseExecutionPackageVerification(true, []);

    $report = $builder->build($package, $verification, '2026-07-13T03:05:00Z');

    expect($report->status)->toBe('hold')
        ->and($report->warnings)->toContain('Release is on hold by gate decision.');
});

it('builds blocked report when verification fails or action is reject_release', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseReadinessReportBuilder';
    $builder = new $builderClass();

    $package = fakeExecutionPackage('reject_release');
    $verification = new OrderSalesShadowReleaseExecutionPackageVerification(false, ['executionPlanArray does not match decoded executionPlanJson.']);

    $report = $builder->build($package, $verification, '2026-07-13T03:10:00Z');

    expect($report->status)->toBe('blocked')
        ->and($report->blockingIssues)->toContain('executionPlanArray does not match decoded executionPlanJson.')
        ->and($report->remediationSteps)->toBe(1);
});

function fakeExecutionPackage(string $action): OrderSalesShadowReleaseExecutionPackage
{
    $releaseReasons = match ($action) {
        'hold_release' => ['Release is on hold by gate decision.'],
        'reject_release' => ['Release is rejected due to failed checks.'],
        default => ['Release approved.'],
    };

    $governanceResult = new OrderSalesShadowGovernanceResult(
        gateResult: new OrderSalesShadowGateResult(
            batchResult: new OrderSalesShadowBatchResult(
                calculations: [],
                report: new ShadowModeBatchReport(
                    generatedAtUtc: '2026-07-13T02:50:00Z',
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
                action: 'enable_limited_rollout',
                approved: true,
                reasons: ['Gate policy evaluated.'],
            ),
        ),
        rolloutPlan: new ShadowModeRolloutPlan(
            generatedAtUtc: '2026-07-13T02:55:00Z',
            recommendedAction: 'enable_limited_rollout',
            approved: true,
            currentBatchOrders: 10,
            steps: [],
        ),
    );

    $governanceArray = ['gate' => ['gate_decision' => ['action' => 'enable_limited_rollout']], 'rollout_plan' => ['recommended_action' => 'enable_limited_rollout']];
    $governanceJson = (string) json_encode($governanceArray, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $pipelineResult = new OrderSalesShadowReleasePipelineResult(
        envelope: new OrderSalesShadowGovernanceEnvelope(
            generatedAtUtc: '2026-07-13T03:00:00Z',
            checksumAlgorithm: 'sha256',
            checksum: hash('sha256', $governanceJson),
            package: new OrderSalesShadowGovernancePackage(
                generatedAtUtc: '2026-07-13T02:59:00Z',
                governanceResult: $governanceResult,
                governanceArray: $governanceArray,
                governanceJson: $governanceJson,
            ),
        ),
        verification: new OrderSalesShadowGovernanceEnvelopeVerification(
            isValid: true,
            expectedChecksum: hash('sha256', $governanceJson),
            actualChecksum: hash('sha256', $governanceJson),
            algorithm: 'sha256',
            errors: [],
        ),
        releaseDecision: new OrderSalesShadowGovernanceReleaseDecision(
            action: $action,
            approved: $action === 'approve_release',
            integrityVerified: $action !== 'reject_release',
            rolloutAction: $action === 'reject_release' ? 'block_rollout' : 'enable_limited_rollout',
            reasons: $releaseReasons,
        ),
    );

    $executionPlan = new OrderSalesShadowReleaseExecutionPlan(
        generatedAtUtc: '2026-07-13T03:02:00Z',
        releaseAction: $action,
        approved: $action === 'approve_release',
        summary: 'Execution plan summary.',
        steps: [
            new OrderSalesShadowReleaseExecutionStep(
                order: 1,
                title: 'Step 1',
                type: 'rollout',
                mandatory: true,
                checks: ['Check A'],
            ),
            new OrderSalesShadowReleaseExecutionStep(
                order: 2,
                title: 'Step 2',
                type: $action === 'reject_release' ? 'remediation' : 'verification',
                mandatory: true,
                checks: ['Check B'],
            ),
        ],
    );

    return new OrderSalesShadowReleaseExecutionPackage(
        generatedAtUtc: '2026-07-13T03:03:00Z',
        pipelineResult: $pipelineResult,
        executionPlan: $executionPlan,
        pipelineArray: ['release_decision' => ['action' => $action]],
        pipelineJson: (string) json_encode(['release_decision' => ['action' => $action]], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        executionPlanArray: ['release_action' => $action],
        executionPlanJson: (string) json_encode(['release_action' => $action], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    );
}
