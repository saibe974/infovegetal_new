<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\Enums\ShadowModeStatus;

final class ShadowModeEvaluator
{
    public function evaluate(
        ?\App\Domain\Sales\DTO\LegacyComparisonReport $comparison,
        int $warningMaxDeltaMinor = 2,
        int $warningMaxDifferences = 5,
    ): \App\Domain\Sales\DTO\ShadowModeEvaluation {
        if ($warningMaxDeltaMinor < 0 || $warningMaxDifferences < 0) {
            throw new \InvalidArgumentException('Shadow mode thresholds must be >= 0.');
        }

        if ($comparison === null) {
            return new \App\Domain\Sales\DTO\ShadowModeEvaluation(
                status: ShadowModeStatus::Skipped,
                differencesCount: 0,
                maxDeltaMinor: 0,
                sampleDifferenceKeys: [],
            );
        }

        if ($comparison->isEquivalent) {
            return new \App\Domain\Sales\DTO\ShadowModeEvaluation(
                status: ShadowModeStatus::Pass,
                differencesCount: 0,
                maxDeltaMinor: 0,
                sampleDifferenceKeys: [],
            );
        }

        $differencesCount = count($comparison->differences);
        $maxDeltaMinor = 0;
        $sample = [];

        foreach ($comparison->differences as $difference) {
            if ($difference->deltaMinor > $maxDeltaMinor) {
                $maxDeltaMinor = $difference->deltaMinor;
            }

            if (count($sample) < 5) {
                $sample[] = $difference->scope . ':' . $difference->metric;
            }
        }

        $isWarning = $maxDeltaMinor <= $warningMaxDeltaMinor && $differencesCount <= $warningMaxDifferences;

        return new \App\Domain\Sales\DTO\ShadowModeEvaluation(
            status: $isWarning ? ShadowModeStatus::Warning : ShadowModeStatus::Fail,
            differencesCount: $differencesCount,
            maxDeltaMinor: $maxDeltaMinor,
            sampleDifferenceKeys: $sample,
        );
    }
}
