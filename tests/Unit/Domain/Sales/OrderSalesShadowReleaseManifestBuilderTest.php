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
use App\Domain\Sales\DTO\OrderSalesShadowReleaseReadinessReport;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseReadinessResult;
use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\DTO\ShadowModeGateDecision;
use App\Domain\Sales\DTO\ShadowModeRolloutPlan;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;

it('builds release manifest with deterministic id for same schema and payload', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestBuilder';
    $builder = new $builderClass();

    $result = fakeReadinessResult();

    $manifestA = $builder->build($result, '2026-07-13T04:30:00Z', '1.0');
    $manifestB = $builder->build($result, '2026-07-13T04:31:00Z', '1.0');

    expect($manifestA->manifestId)->toBe($manifestB->manifestId)
        ->and($manifestA->status)->toBe('ready')
        ->and($manifestA->releaseAction)->toBe('approve_release')
        ->and($manifestA->approved)->toBeTrue();
});

it('changes manifest id when schema version changes', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestBuilder';
    $builder = new $builderClass();

    $result = fakeReadinessResult();

    $manifestV1 = $builder->build($result, '2026-07-13T04:35:00Z', '1.0');
    $manifestV2 = $builder->build($result, '2026-07-13T04:35:00Z', '2.0');

    expect($manifestV1->manifestId)->not->toBe($manifestV2->manifestId);
});

function fakeReadinessResult(): OrderSalesShadowReleaseReadinessResult
{
    $governanceResult = new OrderSalesShadowGovernanceResult(
        gateResult: new OrderSalesShadowGateResult(
            batchResult: new OrderSalesShadowBatchResult(
                calculations: [],
                report: new ShadowModeBatchReport(
                    generatedAtUtc: '2026-07-13T04:00:00Z',
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
            generatedAtUtc: '2026-07-13T04:05:00Z',
            recommendedAction: 'enable_limited_rollout',
            approved: true,
            currentBatchOrders: 10,
            steps: [],
        ),
    );

    $governanceArray = ['gate' => ['gate_decision' => ['action' => 'enable_limited_rollout']], 'rollout_plan' => ['recommended_action' => 'enable_limited_rollout']];
    $governanceJson = (string) json_encode($governanceArray, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $executionPackage = new OrderSalesShadowReleaseExecutionPackage(
        generatedAtUtc: '2026-07-13T04:10:00Z',
        pipelineResult: new OrderSalesShadowReleasePipelineResult(
            envelope: new OrderSalesShadowGovernanceEnvelope(
                generatedAtUtc: '2026-07-13T04:15:00Z',
                checksumAlgorithm: 'sha256',
                checksum: hash('sha256', $governanceJson),
                package: new OrderSalesShadowGovernancePackage(
                    generatedAtUtc: '2026-07-13T04:12:00Z',
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
                action: 'approve_release',
                approved: true,
                integrityVerified: true,
                rolloutAction: 'enable_limited_rollout',
                reasons: ['Envelope integrity verified.', 'Gate action allows rollout.'],
            ),
        ),
        executionPlan: new OrderSalesShadowReleaseExecutionPlan(
            generatedAtUtc: '2026-07-13T04:20:00Z',
            releaseAction: 'approve_release',
            approved: true,
            summary: 'Execution plan summary.',
            steps: [
                new OrderSalesShadowReleaseExecutionStep(order: 1, title: 'Step 1', type: 'rollout', mandatory: true, checks: ['Check A']),
                new OrderSalesShadowReleaseExecutionStep(order: 2, title: 'Step 2', type: 'verification', mandatory: true, checks: ['Check B']),
            ],
        ),
        pipelineArray: ['release_decision' => ['action' => 'approve_release']],
        pipelineJson: (string) json_encode(['release_decision' => ['action' => 'approve_release']], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        executionPlanArray: ['release_action' => 'approve_release'],
        executionPlanJson: (string) json_encode(['release_action' => 'approve_release'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    );

    return new OrderSalesShadowReleaseReadinessResult(
        executionPackage: $executionPackage,
        executionPackageVerification: new OrderSalesShadowReleaseExecutionPackageVerification(
            isValid: true,
            errors: [],
        ),
        readinessReport: new OrderSalesShadowReleaseReadinessReport(
            generatedAtUtc: '2026-07-13T04:25:00Z',
            status: 'ready',
            releaseAction: 'approve_release',
            integrityValid: true,
            requiredSteps: 2,
            remediationSteps: 0,
            blockingIssues: [],
            warnings: [],
        ),
    );
}
