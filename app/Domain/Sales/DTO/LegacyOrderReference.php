<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\ValueObjects\Money;

final readonly class LegacyOrderReference
{
    /**
     * @param list<\App\Domain\Sales\DTO\LegacyLineReference> $lines
     */
    public function __construct(
        public Money $totalHt,
        public Money $totalVat,
        public Money $totalTtc,
        public array $lines,
    ) {
        foreach ($lines as $line) {
            if (!is_a($line, 'App\\Domain\\Sales\\DTO\\LegacyLineReference')) {
                throw new \InvalidArgumentException('LegacyOrderReference lines must be LegacyLineReference instances.');
            }
        }
    }
}
