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
use App\Domain\Sales\Services\ShadowModeBatchAnalyzer;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;

it('returns block when at least one fail exists', function (): void {
    $analyzer = new ShadowModeBatchAnalyzer();

    $summary = $analyzer->analyze([
        fakeResult(ShadowModeStatus::Pass, 0),
        fakeResult(ShadowModeStatus::Fail, 7),
        fakeResult(ShadowModeStatus::Warning, 2),
    ]);

    expect($summary->promotionDecision)->toBe(ShadowModePromotionDecision::Block)
        ->and($summary->failCount)->toBe(1)
        ->and($summary->maxDeltaMinor)->toBe(7)
        ->and($summary->sampleFailedOrderIndexes)->toBe([1]);
});

it('returns promote when warning and skipped rates are within thresholds', function (): void {
    $analyzer = new ShadowModeBatchAnalyzer();

    $summary = $analyzer->analyze(
        results: [
            fakeResult(ShadowModeStatus::Pass, 0),
            fakeResult(ShadowModeStatus::Pass, 0),
            fakeResult(ShadowModeStatus::Warning, 1),
            fakeResult(ShadowModeStatus::Skipped, 0),
            fakeResult(ShadowModeStatus::Pass, 0),
        ],
        maxWarningRatePercentForPromote: 25,
        maxSkippedRatePercentForPromote: 25,
    );

    expect($summary->promotionDecision)->toBe(ShadowModePromotionDecision::Promote)
        ->and($summary->warningCount)->toBe(1)
        ->and($summary->skippedCount)->toBe(1);
});

it('returns hold when no fail but thresholds are exceeded', function (): void {
    $analyzer = new ShadowModeBatchAnalyzer();

    $summary = $analyzer->analyze(
        results: [
            fakeResult(ShadowModeStatus::Warning, 2),
            fakeResult(ShadowModeStatus::Warning, 1),
            fakeResult(ShadowModeStatus::Pass, 0),
            fakeResult(ShadowModeStatus::Skipped, 0),
        ],
        maxWarningRatePercentForPromote: 10,
        maxSkippedRatePercentForPromote: 10,
    );

    expect($summary->promotionDecision)->toBe(ShadowModePromotionDecision::Hold)
        ->and($summary->warningCount)->toBe(2)
        ->and($summary->skippedCount)->toBe(1);
});

function fakeResult(ShadowModeStatus $status, int $maxDeltaMinor): SalesOrderCalculationResult
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
        legacyComparisonReport: new LegacyComparisonReport(true, 0, []),
        shadowModeEvaluation: new ShadowModeEvaluation($status, 1, $maxDeltaMinor, ['sample']),
    );
}
