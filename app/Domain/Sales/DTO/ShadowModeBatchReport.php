<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class ShadowModeBatchReport
{
    /**
     * @param list<\App\Domain\Sales\DTO\ShadowModeOrderIssue> $topIssues
     */
    public function __construct(
        public string $generatedAtUtc,
        public ShadowModeBatchSummary $summary,
        public array $topIssues,
    ) {
        foreach ($topIssues as $issue) {
            if (!is_a($issue, 'App\\Domain\\Sales\\DTO\\ShadowModeOrderIssue')) {
                throw new \InvalidArgumentException('ShadowModeBatchReport topIssues must be ShadowModeOrderIssue instances.');
            }
        }
    }
}
