<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class ShadowModeOrderIssue
{
    /**
     * @param list<string> $sampleDifferenceKeys
     */
    public function __construct(
        public int $orderIndex,
        public \App\Domain\Sales\Enums\ShadowModeStatus $status,
        public int $differencesCount,
        public int $maxDeltaMinor,
        public array $sampleDifferenceKeys,
    ) {
    }
}
