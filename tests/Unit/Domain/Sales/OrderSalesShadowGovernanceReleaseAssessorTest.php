<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowBatchResult;
use App\Domain\Sales\DTO\OrderSalesShadowGateResult;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceEnvelope;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceEnvelopeVerification;
use App\Domain\Sales\DTO\OrderSalesShadowGovernancePackage;
use App\Domain\Sales\DTO\OrderSalesShadowGovernanceResult;
use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\DTO\ShadowModeGateDecision;
use App\Domain\Sales\DTO\ShadowModeRolloutPlan;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;

it('approves release when integrity is valid and rollout action is limited/general', function (): void {
    $assessorClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceReleaseAssessor';
    $assessor = new $assessorClass();

    $verification = new OrderSalesShadowGovernanceEnvelopeVerification(
        isValid: true,
        expectedChecksum: 'abc',
        actualChecksum: 'abc',
        algorithm: 'sha256',
        errors: [],
    );

    $decision = $assessor->assess($verification, makeEnvelopeWithAction('enable_limited_rollout'));

    expect($decision->approved)->toBeTrue()
        ->and($decision->action)->toBe('approve_release')
        ->and($decision->integrityVerified)->toBeTrue();
});

it('holds release when integrity is valid but gate says keep shadow only', function (): void {
    $assessorClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceReleaseAssessor';
    $assessor = new $assessorClass();

    $verification = new OrderSalesShadowGovernanceEnvelopeVerification(
        isValid: true,
        expectedChecksum: 'abc',
        actualChecksum: 'abc',
        algorithm: 'sha256',
        errors: [],
    );

    $decision = $assessor->assess($verification, makeEnvelopeWithAction('keep_shadow_only'));

    expect($decision->approved)->toBeFalse()
        ->and($decision->action)->toBe('hold_release')
        ->and($decision->rolloutAction)->toBe('keep_shadow_only');
});

it('rejects release when integrity verification fails', function (): void {
    $assessorClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceReleaseAssessor';
    $assessor = new $assessorClass();

    $verification = new OrderSalesShadowGovernanceEnvelopeVerification(
        isValid: false,
        expectedChecksum: 'abc',
        actualChecksum: 'def',
        algorithm: 'sha256',
        errors: ['Checksum mismatch between envelope and package payload.'],
    );

    $decision = $assessor->assess($verification, makeEnvelopeWithAction('enable_general_rollout'));

    expect($decision->approved)->toBeFalse()
        ->and($decision->action)->toBe('reject_release')
        ->and($decision->integrityVerified)->toBeFalse()
        ->and($decision->reasons)->toContain('Envelope verification failed.');
});

function makeEnvelopeWithAction(string $gateAction): OrderSalesShadowGovernanceEnvelope
{
    $governanceResult = new OrderSalesShadowGovernanceResult(
        gateResult: new OrderSalesShadowGateResult(
            batchResult: new OrderSalesShadowBatchResult(
                calculations: [],
                report: new ShadowModeBatchReport(
                    generatedAtUtc: '2026-07-13T00:20:00Z',
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
                action: $gateAction,
                approved: $gateAction === 'enable_limited_rollout' || $gateAction === 'enable_general_rollout',
                reasons: ['Gate policy evaluated.'],
            ),
        ),
        rolloutPlan: new ShadowModeRolloutPlan(
            generatedAtUtc: '2026-07-13T00:25:00Z',
            recommendedAction: $gateAction,
            approved: $gateAction === 'enable_limited_rollout' || $gateAction === 'enable_general_rollout',
            currentBatchOrders: 10,
            steps: [],
        ),
    );

    $array = [
        'gate' => [
            'gate_decision' => [
                'action' => $gateAction,
                'approved' => $gateAction === 'enable_limited_rollout' || $gateAction === 'enable_general_rollout',
                'reasons' => ['Gate policy evaluated.'],
            ],
            'batch_report' => [
                'generated_at_utc' => '2026-07-13T00:20:00Z',
                'summary' => [
                    'total_orders' => 10,
                    'pass_count' => 10,
                    'warning_count' => 0,
                    'fail_count' => 0,
                    'skipped_count' => 0,
                    'max_delta_minor' => 0,
                    'promotion_decision' => 'promote',
                    'sample_failed_order_indexes' => [],
                ],
                'top_issues' => [],
            ],
        ],
        'rollout_plan' => [
            'generated_at_utc' => '2026-07-13T00:25:00Z',
            'recommended_action' => $gateAction,
            'approved' => $gateAction === 'enable_limited_rollout' || $gateAction === 'enable_general_rollout',
            'current_batch_orders' => 10,
            'steps' => [],
        ],
    ];

    $json = (string) json_encode($array, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $package = new OrderSalesShadowGovernancePackage(
        generatedAtUtc: '2026-07-13T00:30:00Z',
        governanceResult: $governanceResult,
        governanceArray: $array,
        governanceJson: $json,
    );

    return new OrderSalesShadowGovernanceEnvelope(
        generatedAtUtc: '2026-07-13T00:35:00Z',
        checksumAlgorithm: 'sha256',
        checksum: hash('sha256', $json),
        package: $package,
    );
}
