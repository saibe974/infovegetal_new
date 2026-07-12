<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\ValueObjects\Money;

final readonly class TransportLineInput
{
    public function __construct(
        public int $lineId,
        public int $rollOccupancyBasisPoints,
        public Money $transportEmbeddedHt,
    ) {
        if ($rollOccupancyBasisPoints < 0) {
            throw new \InvalidArgumentException('rollOccupancyBasisPoints must be >= 0.');
        }
    }
}
