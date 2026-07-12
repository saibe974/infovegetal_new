<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\ValueObjects\Money;

final readonly class LegacyLineReference
{
    public function __construct(
        public int $lineId,
        public Money $totalHt,
        public Money $totalVat,
        public Money $totalTtc,
    ) {
    }
}
