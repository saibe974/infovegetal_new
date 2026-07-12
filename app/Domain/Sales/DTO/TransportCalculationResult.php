<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class TransportCalculationResult
{
    /**
     * @param list<TransportAllocation> $lineAllocations
     */
    public function __construct(
        public OrderTransportBreakdown $orderBreakdown,
        public array $lineAllocations,
    ) {
        foreach ($lineAllocations as $allocation) {
            if (!$allocation instanceof TransportAllocation) {
                throw new \InvalidArgumentException('TransportCalculationResult lineAllocations must be TransportAllocation instances.');
            }
        }
    }
}
