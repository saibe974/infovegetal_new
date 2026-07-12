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
use App\Domain\Sales\Enums\ShadowModePromotionDecision;

it('serializes release pipeline result to deterministic array', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleasePipelineResultSerializer';
    $serializer = new $serializerClass();

    $result = makePipelineResult();
    $array = $serializer->toArray($result);

    expect($array['envelope']['checksum_algorithm'])->toBe('sha256')
        ->and($array['verification']['is_valid'])->toBeTrue()
        ->and($array['release_decision']['action'])->toBe('approve_release')
        ->and($array['governance']['rollout_plan']['recommended_action'])->toBe('enable_limited_rollout');
});

it('serializes release pipeline result to valid json', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleasePipelineResultSerializer';
    $serializer = new $serializerClass();

    $result = makePipelineResult();
    $json = $serializer->toJson($result);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['release_decision']['approved'])->toBeTrue()
        ->and($decoded['verification']['algorithm'])->toBe('sha256')
        ->and($decoded['governance']['gate']['gate_decision']['action'])->toBe('enable_limited_rollout');
});

function makePipelineResult(): OrderSalesShadowReleasePipelineResult
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
                action: 'enable_limited_rollout',
                approved: true,
                reasons: ['Gate policy evaluated.'],
            ),
        ),
        rolloutPlan: new ShadowModeRolloutPlan(
            generatedAtUtc: '2026-07-13T01:25:00Z',
            recommendedAction: 'enable_limited_rollout',
            approved: true,
            currentBatchOrders: 10,
            steps: [],
        ),
    );

    $governanceArray = [
        'gate' => [
            'gate_decision' => [
                'action' => 'enable_limited_rollout',
                'approved' => true,
                'reasons' => ['Gate policy evaluated.'],
            ],
            'batch_report' => [
                'generated_at_utc' => '2026-07-13T01:20:00Z',
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
            'generated_at_utc' => '2026-07-13T01:25:00Z',
            'recommended_action' => 'enable_limited_rollout',
            'approved' => true,
            'current_batch_orders' => 10,
            'steps' => [],
        ],
    ];

    $governanceJson = (string) json_encode($governanceArray, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $envelope = new OrderSalesShadowGovernanceEnvelope(
        generatedAtUtc: '2026-07-13T01:30:00Z',
        checksumAlgorithm: 'sha256',
        checksum: hash('sha256', $governanceJson),
        package: new OrderSalesShadowGovernancePackage(
            generatedAtUtc: '2026-07-13T01:29:00Z',
            governanceResult: $governanceResult,
            governanceArray: $governanceArray,
            governanceJson: $governanceJson,
        ),
    );

    $verification = new OrderSalesShadowGovernanceEnvelopeVerification(
        isValid: true,
        expectedChecksum: $envelope->checksum,
        actualChecksum: $envelope->checksum,
        algorithm: 'sha256',
        errors: [],
    );

    $releaseDecision = new OrderSalesShadowGovernanceReleaseDecision(
        action: 'approve_release',
        approved: true,
        integrityVerified: true,
        rolloutAction: 'enable_limited_rollout',
        reasons: ['Envelope integrity verified.', 'Gate action allows rollout.'],
    );

    return new OrderSalesShadowReleasePipelineResult(
        envelope: $envelope,
        verification: $verification,
        releaseDecision: $releaseDecision,
    );
}
