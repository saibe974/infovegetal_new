<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class ShadowModeBatchSummary
{
    /**
     * @param list<int> $sampleFailedOrderIndexes
     */
    public function __construct(
        public int $totalOrders,
        public int $passCount,
        public int $warningCount,
        public int $failCount,
        public int $skippedCount,
        public int $maxDeltaMinor,
        public mixed $promotionDecision,
        public array $sampleFailedOrderIndexes,
    ) {
    }
}
