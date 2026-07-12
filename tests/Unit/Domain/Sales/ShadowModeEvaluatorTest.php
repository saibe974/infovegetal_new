<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\LegacyComparisonDifference;
use App\Domain\Sales\DTO\LegacyComparisonReport;
use App\Domain\Sales\Enums\ShadowModeStatus;
use App\Domain\Sales\Services\ShadowModeEvaluator;

it('returns skipped when no comparison exists', function (): void {
    $evaluation = (new ShadowModeEvaluator())->evaluate(null);

    expect($evaluation->status)->toBe(ShadowModeStatus::Skipped)
        ->and($evaluation->differencesCount)->toBe(0)
        ->and($evaluation->maxDeltaMinor)->toBe(0);
});

it('returns pass when comparison is equivalent', function (): void {
    $report = new LegacyComparisonReport(
        isEquivalent: true,
        toleranceMinor: 0,
        differences: [],
    );

    $evaluation = (new ShadowModeEvaluator())->evaluate($report);

    expect($evaluation->status)->toBe(ShadowModeStatus::Pass)
        ->and($evaluation->differencesCount)->toBe(0)
        ->and($evaluation->maxDeltaMinor)->toBe(0);
});

it('returns warning when deltas and count are within warning thresholds', function (): void {
    $report = new LegacyComparisonReport(
        isEquivalent: false,
        toleranceMinor: 0,
        differences: [
            new LegacyComparisonDifference('order', 'total_ht', 1000, 1001, 1),
            new LegacyComparisonDifference('line:1', 'total_ttc', 500, 502, 2),
        ],
    );

    $evaluation = (new ShadowModeEvaluator())->evaluate(
        comparison: $report,
        warningMaxDeltaMinor: 2,
        warningMaxDifferences: 5,
    );

    expect($evaluation->status)->toBe(ShadowModeStatus::Warning)
        ->and($evaluation->differencesCount)->toBe(2)
        ->and($evaluation->maxDeltaMinor)->toBe(2)
        ->and($evaluation->sampleDifferenceKeys)->toContain('order:total_ht');
});

it('returns fail when deltas exceed thresholds', function (): void {
    $report = new LegacyComparisonReport(
        isEquivalent: false,
        toleranceMinor: 0,
        differences: [
            new LegacyComparisonDifference('order', 'total_ht', 1000, 1010, 10),
        ],
    );

    $evaluation = (new ShadowModeEvaluator())->evaluate(
        comparison: $report,
        warningMaxDeltaMinor: 2,
        warningMaxDifferences: 5,
    );

    expect($evaluation->status)->toBe(ShadowModeStatus::Fail)
        ->and($evaluation->differencesCount)->toBe(1)
        ->and($evaluation->maxDeltaMinor)->toBe(10);
});
