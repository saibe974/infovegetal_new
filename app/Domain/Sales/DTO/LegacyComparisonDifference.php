<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class LegacyComparisonDifference
{
    public function __construct(
        public string $scope,
        public string $metric,
        public int $legacyMinor,
        public int $engineMinor,
        public int $deltaMinor,
    ) {
    }
}
