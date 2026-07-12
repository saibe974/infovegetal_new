<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\Enums\ShadowModePromotionDecision;
use App\Domain\Sales\Enums\ShadowModeStatus;

final class ShadowModeBatchAnalyzer
{
    /**
     * @param list<\App\Domain\Sales\DTO\SalesOrderCalculationResult> $results
     */
    public function analyze(
        array $results,
        int $maxWarningRatePercentForPromote = 10,
        int $maxSkippedRatePercentForPromote = 20,
    ): \App\Domain\Sales\DTO\ShadowModeBatchSummary {
        if ($maxWarningRatePercentForPromote < 0 || $maxWarningRatePercentForPromote > 100) {
            throw new \InvalidArgumentException('maxWarningRatePercentForPromote must be between 0 and 100.');
        }

        if ($maxSkippedRatePercentForPromote < 0 || $maxSkippedRatePercentForPromote > 100) {
            throw new \InvalidArgumentException('maxSkippedRatePercentForPromote must be between 0 and 100.');
        }

        $total = count($results);
        $pass = 0;
        $warning = 0;
        $fail = 0;
        $skipped = 0;
        $maxDelta = 0;
        $failedIndexes = [];

        foreach ($results as $index => $result) {
            $status = $result->shadowModeEvaluation->status;

            if ($result->shadowModeEvaluation->maxDeltaMinor > $maxDelta) {
                $maxDelta = $result->shadowModeEvaluation->maxDeltaMinor;
            }

            switch ($status) {
                case ShadowModeStatus::Pass:
                    $pass++;
                    break;
                case ShadowModeStatus::Warning:
                    $warning++;
                    break;
                case ShadowModeStatus::Fail:
                    $fail++;
                    if (count($failedIndexes) < 10) {
                        $failedIndexes[] = $index;
                    }
                    break;
                case ShadowModeStatus::Skipped:
                    $skipped++;
                    break;
            }
        }

        $decision = ShadowModePromotionDecision::Hold;
        if ($total === 0) {
            $decision = ShadowModePromotionDecision::Hold;
        } elseif ($fail > 0) {
            $decision = ShadowModePromotionDecision::Block;
        } else {
            $warningRate = intdiv($warning * 100, $total);
            $skippedRate = intdiv($skipped * 100, $total);

            $decision = ($warningRate <= $maxWarningRatePercentForPromote && $skippedRate <= $maxSkippedRatePercentForPromote)
                ? ShadowModePromotionDecision::Promote
                : ShadowModePromotionDecision::Hold;
        }

        return new \App\Domain\Sales\DTO\ShadowModeBatchSummary(
            totalOrders: $total,
            passCount: $pass,
            warningCount: $warning,
            failCount: $fail,
            skippedCount: $skipped,
            maxDeltaMinor: $maxDelta,
            promotionDecision: $decision,
            sampleFailedOrderIndexes: $failedIndexes,
        );
    }
}
