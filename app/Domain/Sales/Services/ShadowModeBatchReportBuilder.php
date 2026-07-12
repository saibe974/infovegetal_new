<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\Enums\ShadowModeStatus;

final class ShadowModeBatchReportBuilder
{
    public function __construct(
        private readonly ShadowModeBatchAnalyzer $analyzer = new ShadowModeBatchAnalyzer(),
    ) {
    }

    /**
     * @param list<\App\Domain\Sales\DTO\SalesOrderCalculationResult> $results
     */
    public function build(
        array $results,
        string $generatedAtUtc,
        int $maxWarningRatePercentForPromote = 10,
        int $maxSkippedRatePercentForPromote = 20,
        int $topIssuesLimit = 20,
    ) {
        if ($topIssuesLimit < 0) {
            throw new \InvalidArgumentException('topIssuesLimit must be >= 0.');
        }

        $summary = $this->analyzer->analyze(
            results: $results,
            maxWarningRatePercentForPromote: $maxWarningRatePercentForPromote,
            maxSkippedRatePercentForPromote: $maxSkippedRatePercentForPromote,
        );

        $issues = [];
        foreach ($results as $index => $result) {
            $evaluation = $result->shadowModeEvaluation;

            if ($evaluation->status === ShadowModeStatus::Pass) {
                continue;
            }

            $issueClass = 'App\\Domain\\Sales\\DTO\\ShadowModeOrderIssue';

            $issues[] = new $issueClass(
                orderIndex: $index,
                status: $evaluation->status,
                differencesCount: $evaluation->differencesCount,
                maxDeltaMinor: $evaluation->maxDeltaMinor,
                sampleDifferenceKeys: $evaluation->sampleDifferenceKeys,
            );
        }

        usort($issues, function ($a, $b): int {
            $statusWeight = static function (ShadowModeStatus $status): int {
                return match ($status) {
                    ShadowModeStatus::Fail => 3,
                    ShadowModeStatus::Warning => 2,
                    ShadowModeStatus::Skipped => 1,
                    ShadowModeStatus::Pass => 0,
                };
            };

            $statusCmp = $statusWeight($b->status) <=> $statusWeight($a->status);
            if ($statusCmp !== 0) {
                return $statusCmp;
            }

            $deltaCmp = $b->maxDeltaMinor <=> $a->maxDeltaMinor;
            if ($deltaCmp !== 0) {
                return $deltaCmp;
            }

            $diffCmp = $b->differencesCount <=> $a->differencesCount;
            if ($diffCmp !== 0) {
                return $diffCmp;
            }

            return $a->orderIndex <=> $b->orderIndex;
        });

        if ($topIssuesLimit > 0) {
            $issues = array_slice($issues, 0, $topIssuesLimit);
        } else {
            $issues = [];
        }

        $reportClass = 'App\\Domain\\Sales\\DTO\\ShadowModeBatchReport';

        return new $reportClass(
            generatedAtUtc: $generatedAtUtc,
            summary: $summary,
            topIssues: $issues,
        );
    }
}
