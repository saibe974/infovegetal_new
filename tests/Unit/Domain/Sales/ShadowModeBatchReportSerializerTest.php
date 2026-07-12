<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ShadowModeBatchReport;
use App\Domain\Sales\DTO\ShadowModeBatchSummary;
use App\Domain\Sales\DTO\ShadowModeOrderIssue;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;
use App\Domain\Sales\Enums\ShadowModeStatus;
use App\Domain\Sales\Services\ShadowModeBatchReportSerializer;

it('serializes shadow batch report to deterministic array structure', function (): void {
    $report = new ShadowModeBatchReport(
        generatedAtUtc: '2026-07-12T18:00:00Z',
        summary: new ShadowModeBatchSummary(
            totalOrders: 4,
            passCount: 2,
            warningCount: 1,
            failCount: 1,
            skippedCount: 0,
            maxDeltaMinor: 12,
            promotionDecision: ShadowModePromotionDecision::Block,
            sampleFailedOrderIndexes: [3],
        ),
        topIssues: [
            new ShadowModeOrderIssue(
                orderIndex: 7,
                status: ShadowModeStatus::Warning,
                differencesCount: 2,
                maxDeltaMinor: 2,
                sampleDifferenceKeys: ['line:7:total_ht'],
            ),
            new ShadowModeOrderIssue(
                orderIndex: 3,
                status: ShadowModeStatus::Fail,
                differencesCount: 5,
                maxDeltaMinor: 12,
                sampleDifferenceKeys: ['order:total_ttc'],
            ),
        ],
    );

    $serialized = (new ShadowModeBatchReportSerializer())->toArray($report);

    expect($serialized['generated_at_utc'])->toBe('2026-07-12T18:00:00Z')
        ->and($serialized['summary']['promotion_decision'])->toBe('block')
        ->and($serialized['top_issues'][0]['order_index'])->toBe(3)
        ->and($serialized['top_issues'][1]['order_index'])->toBe(7)
        ->and($serialized['top_issues'][0]['status'])->toBe('fail');
});

it('serializes report to valid json', function (): void {
    $report = new ShadowModeBatchReport(
        generatedAtUtc: '2026-07-12T18:00:00Z',
        summary: new ShadowModeBatchSummary(
            totalOrders: 1,
            passCount: 1,
            warningCount: 0,
            failCount: 0,
            skippedCount: 0,
            maxDeltaMinor: 0,
            promotionDecision: ShadowModePromotionDecision::Promote,
            sampleFailedOrderIndexes: [],
        ),
        topIssues: [],
    );

    $json = (new ShadowModeBatchReportSerializer())->toJson($report);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['summary']['promotion_decision'])->toBe('promote')
        ->and($decoded['top_issues'])->toBeArray();
});
