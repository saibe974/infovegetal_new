<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\ValueObjects\Money;

final readonly class OrderCalculationBreakdown
{
    /**
     * @param list<SalesLineBreakdown> $lines
     * @param list<CalculationWarning> $warnings
     */
    public function __construct(
        public array $lines,
        public TransportCalculationResult $transport,
        public Money $productsHt,
        public Money $productsVat,
        public Money $transportHt,
        public Money $transportVat,
        public Money $totalHt,
        public Money $totalVat,
        public Money $totalTtc,
        public array $warnings,
    ) {
        foreach ($lines as $line) {
            if (!$line instanceof SalesLineBreakdown) {
                throw new \InvalidArgumentException('OrderCalculationBreakdown lines must be SalesLineBreakdown instances.');
            }
        }

        foreach ($warnings as $warning) {
            if (!$warning instanceof CalculationWarning) {
                throw new \InvalidArgumentException('OrderCalculationBreakdown warnings must be CalculationWarning instances.');
            }
        }
    }
}
