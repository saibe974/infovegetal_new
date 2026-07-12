<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

final readonly class TransportAllocation
{
    public function __construct(
        public int $lineId,
        public int $rollOccupancyBasisPoints,
        public Money $transportEmbeddedHt,
        public Money $transportAdditionalHt,
        public Money $transportTotalChargedHt,
        public Money $transportEconomicCostAllocatedHt,
        public Percentage $transportVatRate,
        public Money $transportVatAmount,
    ) {
    }
}
