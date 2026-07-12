<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\CustomerInvoiceProjection;
use App\Domain\Sales\DTO\ExpectedSettlementCollection;
use App\Domain\Sales\DTO\LegacyComparisonReport;
use App\Domain\Sales\DTO\OrderCalculationBreakdown;
use App\Domain\Sales\DTO\SalesCalculationSnapshot;
use App\Domain\Sales\DTO\SalesOrderCalculationResult;
use App\Domain\Sales\DTO\ShadowModeEvaluation;
use App\Domain\Sales\Enums\ShadowModePromotionDecision;
use App\Domain\Sales\Enums\ShadowModeStatus;
use App\Domain\Sales\Services\ShadowModeBatchReportBuilder;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;

it('builds a report with sorted top issues and consistent summary', function (): void {
    $builder = new ShadowModeBatchReportBuilder();

    $results = [
        fakeShadowResult(ShadowModeStatus::Pass, 0, 0),
        fakeShadowResult(ShadowModeStatus::Warning, 2, 2),
        fakeShadowResult(ShadowModeStatus::Fail, 3, 15),
        fakeShadowResult(ShadowModeStatus::Skipped, 0, 0),
        fakeShadowResult(ShadowModeStatus::Fail, 1, 8),
    ];

    $report = $builder->build(
        results: $results,
        generatedAtUtc: '2026-07-12T14:00:00Z',
        maxWarningRatePercentForPromote: 20,
        maxSkippedRatePercentForPromote: 20,
        topIssuesLimit: 3,
    );

    expect($report->generatedAtUtc)->toBe('2026-07-12T14:00:00Z')
        ->and($report->summary->promotionDecision)->toBe(ShadowModePromotionDecision::Block)
        ->and($report->summary->failCount)->toBe(2)
        ->and($report->summary->warningCount)->toBe(1)
        ->and($report->summary->skippedCount)->toBe(1)
        ->and(count($report->topIssues))->toBe(3)
        ->and($report->topIssues[0]->status)->toBe(ShadowModeStatus::Fail)
        ->and($report->topIssues[0]->maxDeltaMinor)->toBe(15)
        ->and($report->topIssues[1]->status)->toBe(ShadowModeStatus::Fail)
        ->and($report->topIssues[1]->maxDeltaMinor)->toBe(8)
        ->and($report->topIssues[2]->status)->toBe(ShadowModeStatus::Warning);
});

it('returns empty top issues when limit is zero', function (): void {
    $builder = new ShadowModeBatchReportBuilder();

    $report = $builder->build(
        results: [fakeShadowResult(ShadowModeStatus::Fail, 1, 5)],
        generatedAtUtc: '2026-07-12T14:00:00Z',
        topIssuesLimit: 0,
    );

    expect($report->topIssues)->toHaveCount(0);
});

function fakeShadowResult(ShadowModeStatus $status, int $differencesCount, int $maxDeltaMinor): SalesOrderCalculationResult
{
    $currency = Currency::EUR;
    $zero = new Money(0, $currency);

    $transportBreakdown = new \App\Domain\Sales\DTO\OrderTransportBreakdown(
        carrierId: null,
        zoneId: null,
        rollCount: 0,
        tariffGrossHt: $zero,
        minimumAppliedHt: $zero,
        transportRealHt: $zero,
        transportEmbeddedInProductsHt: $zero,
        transportRemainingHt: $zero,
        transportChargedOnLinesHt: $zero,
        transportChargedAsOrderFeeHt: $zero,
        transportVatRate: \App\Domain\Sales\ValueObjects\Percentage::fromString('0'),
        transportVatTotal: $zero,
        transportTtc: $zero,
    );

    $transportResult = new \App\Domain\Sales\DTO\TransportCalculationResult(
        orderBreakdown: $transportBreakdown,
        lineAllocations: [],
    );

    $breakdown = new OrderCalculationBreakdown(
        lines: [],
        transport: $transportResult,
        productsHt: $zero,
        productsVat: $zero,
        transportHt: $zero,
        transportVat: $zero,
        totalHt: $zero,
        totalVat: $zero,
        totalTtc: $zero,
        warnings: [],
    );

    $invoice = new CustomerInvoiceProjection(
        lines: [],
        productsHt: $zero,
        productsVat: $zero,
        productsTtc: $zero,
        transportHt: $zero,
        transportVat: $zero,
        transportTtc: $zero,
        transportOrderFeeHt: $zero,
        transportOrderFeeVat: $zero,
        transportOrderFeeTtc: $zero,
        totalHt: $zero,
        totalVat: $zero,
        totalTtc: $zero,
    );

    $snapshot = new SalesCalculationSnapshot(
        schemaVersion: '1.0',
        engineVersion: 'sales-engine-v1',
        generatedAtUtc: '2026-07-12T00:00:00Z',
        payload: [],
        checksum: 'x',
    );

    return new SalesOrderCalculationResult(
        orderBreakdown: $breakdown,
        customerInvoice: $invoice,
        expectedSettlements: new ExpectedSettlementCollection([]),
        snapshot: $snapshot,
        legacyComparisonReport: new LegacyComparisonReport(false, 0, []),
        shadowModeEvaluation: new ShadowModeEvaluation(
            status: $status,
            differencesCount: $differencesCount,
            maxDeltaMinor: $maxDeltaMinor,
            sampleDifferenceKeys: ['sample:key'],
        ),
    );
}
