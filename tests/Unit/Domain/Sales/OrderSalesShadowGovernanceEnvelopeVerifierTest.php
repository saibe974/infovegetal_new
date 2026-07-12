<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowBatchResult;
use App\Domain\Sales\DTO\OrderSalesShadowGateResult;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceEnvelope;
use App\Domain\Sales\DTO\OrderSalesShadowGovernancePackage;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceResult;
use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\DTO\ShadowModeGateDecision;
use App\Domain\Sales\DTO\ShadowModeRolloutPlan;
use App\Domain\Sales\DTO\ShadowModeRolloutStep;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;

it('validates envelope when checksum and payload are consistent', function (): void {
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceEnvelopeVerifier';
    $verifier = new $verifierClass();

    $envelope = makeEnvelope();
    $verification = $verifier->verify($envelope);

    expect($verification->isValid)->toBeTrue()
        ->and($verification->algorithm)->toBe('sha256')
        ->and($verification->expectedChecksum)->toBe($verification->actualChecksum)
        ->and($verification->errors)->toBe([]);
});

it('fails verification when checksum is modified', function (): void {
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceEnvelopeVerifier';
    $verifier = new $verifierClass();

    $envelope = makeEnvelope();

    $tampered = new OrderSalesShadowGovernanceEnvelope(
        generatedAtUtc: $envelope->generatedAtUtc,
        checksumAlgorithm: $envelope->checksumAlgorithm,
        checksum: str_repeat('0', 64),
        package: $envelope->package,
    );

    $verification = $verifier->verify($tampered);

    expect($verification->isValid)->toBeFalse()
        ->and($verification->errors)->toContain('Checksum mismatch between envelope and package payload.');
});

it('fails verification when package array diverges from package json', function (): void {
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceEnvelopeVerifier';
    $verifier = new $verifierClass();

    $envelope = makeEnvelope();

    $tamperedPackage = new OrderSalesShadowGovernancePackage(
        generatedAtUtc: $envelope->package->generatedAtUtc,
        governanceResult: $envelope->package->governanceResult,
        governanceArray: ['unexpected' => 'value'],
        governanceJson: $envelope->package->governanceJson,
    );

    $tampered = new OrderSalesShadowGovernanceEnvelope(
        generatedAtUtc: $envelope->generatedAtUtc,
        checksumAlgorithm: 'sha256',
        checksum: hash('sha256', $tamperedPackage->governanceJson),
        package: $tamperedPackage,
    );

    $verification = $verifier->verify($tampered);

    expect($verification->isValid)->toBeFalse()
        ->and($verification->errors)->toContain('Package governanceArray does not match decoded governanceJson.');
});

function makeEnvelope(): OrderSalesShadowGovernanceEnvelope
{
    $governanceResult = new OrderSalesShadowGovernanceResult(
        gateResult: new OrderSalesShadowGateResult(
            batchResult: new OrderSalesShadowBatchResult(
                calculations: [],
                report: new ShadowModeBatchReport(
                    generatedAtUtc: '2026-07-13T00:00:00Z',
                    summary: new ShadowModeBatchSummary(
                        totalOrders: 10,
                        passCount: 9,
                        warningCount: 1,
                        failCount: 0,
                        skippedCount: 0,
                        maxDeltaMinor: 1,
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
            generatedAtUtc: '2026-07-13T00:05:00Z',
            recommendedAction: 'enable_limited_rollout',
            approved: true,
            currentBatchOrders: 10,
            steps: [
                new ShadowModeRolloutStep(
                    phase: 'canary',
                    trafficPercent: 10,
                    durationHours: 24,
                    action: 'enable_limited_rollout',
                    requiresManualValidation: false,
                    notes: ['Observe metrics.'],
                ),
            ],
        ),
    );

    $array = [
        'gate' => [
            'gate_decision' => [
                'action' => 'enable_limited_rollout',
                'approved' => true,
                'reasons' => ['Policy approved limited rollout.'],
            ],
            'batch_report' => [
                'generated_at_utc' => '2026-07-13T00:00:00Z',
                'summary' => [
                    'total_orders' => 10,
                    'pass_count' => 9,
                    'warning_count' => 1,
                    'fail_count' => 0,
                    'skipped_count' => 0,
                    'max_delta_minor' => 1,
                    'promotion_decision' => 'promote',
                    'sample_failed_order_indexes' => [],
                ],
                'top_issues' => [],
            ],
        ],
        'rollout_plan' => [
            'generated_at_utc' => '2026-07-13T00:05:00Z',
            'recommended_action' => 'enable_limited_rollout',
            'approved' => true,
            'current_batch_orders' => 10,
            'steps' => [
                [
                    'phase' => 'canary',
                    'traffic_percent' => 10,
                    'duration_hours' => 24,
                    'action' => 'enable_limited_rollout',
                    'requires_manual_validation' => false,
                    'notes' => ['Observe metrics.'],
                ],
            ],
        ],
    ];

    $json = (string) json_encode($array, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $package = new OrderSalesShadowGovernancePackage(
        generatedAtUtc: '2026-07-13T00:10:00Z',
        governanceResult: $governanceResult,
        governanceArray: $array,
        governanceJson: $json,
    );

    return new OrderSalesShadowGovernanceEnvelope(
        generatedAtUtc: '2026-07-13T00:15:00Z',
        checksumAlgorithm: 'sha256',
        checksum: hash('sha256', $json),
        package: $package,
    );
}
