<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class ShadowModeEvaluation
{
    /**
     * @param list<string> $sampleDifferenceKeys
     */
    public function __construct(
        public \App\Domain\Sales\Enums\ShadowModeStatus $status,
        public int $differencesCount,
        public int $maxDeltaMinor,
        public array $sampleDifferenceKeys,
    ) {
    }
}
