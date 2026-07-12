<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class ShadowModeBatchReportSerializer
{
    public function toArray(\App\Domain\Sales\DTO\ShadowModeBatchReport $report): array
    {
        $issues = $report->topIssues;
        usort($issues, static fn ($a, $b): int => $a->orderIndex <=> $b->orderIndex);

        $serializedIssues = [];
        foreach ($issues as $issue) {
            $serializedIssues[] = [
                'order_index' => $issue->orderIndex,
                'status' => $issue->status->value,
                'differences_count' => $issue->differencesCount,
                'max_delta_minor' => $issue->maxDeltaMinor,
                'sample_difference_keys' => array_values($issue->sampleDifferenceKeys),
            ];
        }

        return [
            'generated_at_utc' => $report->generatedAtUtc,
            'summary' => [
                'total_orders' => $report->summary->totalOrders,
                'pass_count' => $report->summary->passCount,
                'warning_count' => $report->summary->warningCount,
                'fail_count' => $report->summary->failCount,
                'skipped_count' => $report->summary->skippedCount,
                'max_delta_minor' => $report->summary->maxDeltaMinor,
                'promotion_decision' => is_object($report->summary->promotionDecision)
                    ? $report->summary->promotionDecision->value
                    : (string) $report->summary->promotionDecision,
                'sample_failed_order_indexes' => array_values($report->summary->sampleFailedOrderIndexes),
            ],
            'top_issues' => $serializedIssues,
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\ShadowModeBatchReport $report): string
    {
        return json_encode($this->toArray($report), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }
}
