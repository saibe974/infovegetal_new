<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\DTO\CalculationWarning;
use App\Domain\Sales\DTO\SalesLineBreakdown;
use App\Domain\Sales\DTO\TransportCalculationResult;
use App\Domain\Sales\ValueObjects\Money;

final class OrderCalculationBreakdownAssembler
{
    /**
     * @param list<SalesLineBreakdown> $lines
     */
    public function assemble(array $lines, TransportCalculationResult $transport): \App\Domain\Sales\DTO\OrderCalculationBreakdown
    {
        $currency = $transport->orderBreakdown->transportRealHt->currency;

        $productsHt = Money::zero($currency);
        $productsVat = Money::zero($currency);
        $warnings = [];

        foreach ($lines as $line) {
            if (!$line instanceof SalesLineBreakdown) {
                throw new \InvalidArgumentException('OrderCalculationBreakdownAssembler lines must be SalesLineBreakdown instances.');
            }

            if ($line->product->finalLineHt->currency !== $currency || $line->product->productVatLineAmount->currency !== $currency) {
                throw new \DomainException('Currency mismatch between product lines and transport breakdown.');
            }

            $productsHt = $productsHt->add($line->product->finalLineHt);
            $productsVat = $productsVat->add($line->product->productVatLineAmount);

            foreach ($line->warnings as $warning) {
                if ($warning instanceof CalculationWarning) {
                    $warnings[] = $warning;
                }
            }
        }

        $transportHt = $transport->orderBreakdown->transportRealHt;
        $transportVat = $transport->orderBreakdown->transportVatTotal;

        $totalHt = $productsHt->add($transportHt);
        $totalVat = $productsVat->add($transportVat);
        $totalTtc = $totalHt->add($totalVat);

        return new \App\Domain\Sales\DTO\OrderCalculationBreakdown(
            lines: $lines,
            transport: $transport,
            productsHt: $productsHt,
            productsVat: $productsVat,
            transportHt: $transportHt,
            transportVat: $transportVat,
            totalHt: $totalHt,
            totalVat: $totalVat,
            totalTtc: $totalTtc,
            warnings: $warnings,
        );
    }
}
