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
use App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionPlan;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionStep;
use App\Domain\Sales\DTO\OrderSalesShadowReleasePipelineResult;
use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\DTO\ShadowModeGateDecision;
use App\Domain\Sales\DTO\ShadowModeRolloutPlan;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;

it('validates execution package when json payloads and actions are consistent', function (): void {
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseExecutionPackageVerifier';
    $verifier = new $verifierClass();

    $package = makeExecutionPackage('approve_release');
    $verification = $verifier->verify($package);

    expect($verification->isValid)->toBeTrue()
        ->and($verification->errors)->toBe([]);
});

it('fails verification when execution json is tampered', function (): void {
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseExecutionPackageVerifier';
    $verifier = new $verifierClass();

    $package = makeExecutionPackage('approve_release');

    $tampered = new OrderSalesShadowReleaseExecutionPackage(
        generatedAtUtc: $package->generatedAtUtc,
        pipelineResult: $package->pipelineResult,
        executionPlan: $package->executionPlan,
        pipelineArray: $package->pipelineArray,
        pipelineJson: $package->pipelineJson,
        executionPlanArray: ['unexpected' => 'value'],
        executionPlanJson: $package->executionPlanJson,
    );

    $verification = $verifier->verify($tampered);

    expect($verification->isValid)->toBeFalse()
        ->and($verification->errors)->toContain('executionPlanArray does not match decoded executionPlanJson.');
});

it('fails verification when actions diverge between pipeline and execution plan', function (): void {
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseExecutionPackageVerifier';
    $verifier = new $verifierClass();

    $package = makeExecutionPackage('approve_release');

    $divergentPlan = new OrderSalesShadowReleaseExecutionPlan(
        generatedAtUtc: $package->executionPlan->generatedAtUtc,
        releaseAction: 'hold_release',
        approved: false,
        summary: $package->executionPlan->summary,
        steps: $package->executionPlan->steps,
    );

    $tampered = new OrderSalesShadowReleaseExecutionPackage(
        generatedAtUtc: $package->generatedAtUtc,
        pipelineResult: $package->pipelineResult,
        executionPlan: $divergentPlan,
        pipelineArray: $package->pipelineArray,
        pipelineJson: $package->pipelineJson,
        executionPlanArray: array_merge($package->executionPlanArray, ['release_action' => 'hold_release']),
        executionPlanJson: (string) json_encode(array_merge($package->executionPlanArray, ['release_action' => 'hold_release']), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    );

    $verification = $verifier->verify($tampered);

    expect($verification->isValid)->toBeFalse()
        ->and($verification->errors)->toContain('release action mismatch between pipelineResult and executionPlan.');
});

function makeExecutionPackage(string $releaseAction): OrderSalesShadowReleaseExecutionPackage
{
    $governanceResult = new OrderSalesShadowGovernanceResult(
        gateResult: new OrderSalesShadowGateResult(
            batchResult: new OrderSalesShadowBatchResult(
                calculations: [],
                report: new ShadowModeBatchReport(
                    generatedAtUtc: '2026-07-13T02:20:00Z',
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
            generatedAtUtc: '2026-07-13T02:25:00Z',
            recommendedAction: 'enable_limited_rollout',
            approved: true,
            currentBatchOrders: 10,
            steps: [],
        ),
    );

    $governanceArray = [
        'gate' => [
            'gate_decision' => ['action' => 'enable_limited_rollout', 'approved' => true, 'reasons' => ['Gate policy evaluated.']],
            'batch_report' => ['generated_at_utc' => '2026-07-13T02:20:00Z', 'summary' => [], 'top_issues' => []],
        ],
        'rollout_plan' => ['generated_at_utc' => '2026-07-13T02:25:00Z', 'recommended_action' => 'enable_limited_rollout', 'approved' => true, 'current_batch_orders' => 10, 'steps' => []],
    ];
    $governanceJson = (string) json_encode($governanceArray, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $pipelineResult = new OrderSalesShadowReleasePipelineResult(
        envelope: new OrderSalesShadowGovernanceEnvelope(
            generatedAtUtc: '2026-07-13T02:35:00Z',
            checksumAlgorithm: 'sha256',
            checksum: hash('sha256', $governanceJson),
            package: new OrderSalesShadowGovernancePackage(
                generatedAtUtc: '2026-07-13T02:30:00Z',
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
            action: $releaseAction,
            approved: $releaseAction === 'approve_release',
            integrityVerified: true,
            rolloutAction: 'enable_limited_rollout',
            reasons: ['Envelope integrity verified.'],
        ),
    );

    $executionPlan = new OrderSalesShadowReleaseExecutionPlan(
        generatedAtUtc: '2026-07-13T02:40:00Z',
        releaseAction: $releaseAction,
        approved: $releaseAction === 'approve_release',
        summary: 'Execution plan summary.',
        steps: [
            new OrderSalesShadowReleaseExecutionStep(
                order: 1,
                title: 'First step',
                type: 'rollout',
                mandatory: true,
                checks: ['Check A'],
            ),
        ],
    );

    $pipelineArray = [
        'release_decision' => [
            'action' => $releaseAction,
            'approved' => $releaseAction === 'approve_release',
            'integrity_verified' => true,
            'rollout_action' => 'enable_limited_rollout',
            'reasons' => ['Envelope integrity verified.'],
        ],
        'verification' => ['is_valid' => true, 'expected_checksum' => 'x', 'actual_checksum' => 'x', 'algorithm' => 'sha256', 'errors' => []],
        'envelope' => ['generated_at_utc' => '2026-07-13T02:35:00Z', 'checksum_algorithm' => 'sha256', 'checksum' => 'x', 'package_generated_at_utc' => '2026-07-13T02:30:00Z'],
        'governance' => $governanceArray,
    ];
    $pipelineJson = (string) json_encode($pipelineArray, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $executionArray = [
        'generated_at_utc' => '2026-07-13T02:40:00Z',
        'release_action' => $releaseAction,
        'approved' => $releaseAction === 'approve_release',
        'summary' => 'Execution plan summary.',
        'steps' => [
            ['order' => 1, 'title' => 'First step', 'type' => 'rollout', 'mandatory' => true, 'checks' => ['Check A']],
        ],
    ];
    $executionJson = (string) json_encode($executionArray, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    return new OrderSalesShadowReleaseExecutionPackage(
        generatedAtUtc: '2026-07-13T02:45:00Z',
        pipelineResult: $pipelineResult,
        executionPlan: $executionPlan,
        pipelineArray: $pipelineArray,
        pipelineJson: $pipelineJson,
        executionPlanArray: $executionArray,
        executionPlanJson: $executionJson,
    );
}
