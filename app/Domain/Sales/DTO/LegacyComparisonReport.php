<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class LegacyComparisonReport
{
    /**
     * @param list<object> $differences
     */
    public function __construct(
        public bool $isEquivalent,
        public int $toleranceMinor,
        public array $differences,
    ) {
        foreach ($differences as $difference) {
            if (!is_a($difference, 'App\\Domain\\Sales\\DTO\\LegacyComparisonDifference')) {
                throw new \InvalidArgumentException('LegacyComparisonReport differences must be LegacyComparisonDifference instances.');
            }
        }
    }
}
