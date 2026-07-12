<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\DTO\OrderCalculationBreakdown;
use App\Domain\Sales\ValueObjects\Money;

final class CustomerInvoiceProjector
{
    public function project(OrderCalculationBreakdown $breakdown): \App\Domain\Sales\DTO\CustomerInvoiceProjection
    {
        $currency = $breakdown->totalHt->currency;
        $allocationByLineId = [];
        foreach ($breakdown->transport->lineAllocations as $allocation) {
            $allocationByLineId[$allocation->lineId] = $allocation;
        }

        $lines = [];
        $productsHt = Money::zero($currency);
        $productsVat = Money::zero($currency);
        $transportOnLinesHt = Money::zero($currency);
        $transportOnLinesVat = Money::zero($currency);

        foreach ($breakdown->lines as $line) {
            $allocation = $allocationByLineId[$line->lineId] ?? null;
            $lineTransportHt = $allocation?->transportTotalChargedHt ?? Money::zero($currency);
            $lineTransportVat = $allocation?->transportVatAmount ?? Money::zero($currency);

            $productHt = $line->product->finalLineHt;
            $productVat = $line->product->productVatLineAmount;
            $productTtc = $productHt->add($productVat);

            $transportTtc = $lineTransportHt->add($lineTransportVat);
            $lineTotalHt = $productHt->add($lineTransportHt);
            $lineTotalVat = $productVat->add($lineTransportVat);
            $lineTotalTtc = $lineTotalHt->add($lineTotalVat);

            $productsHt = $productsHt->add($productHt);
            $productsVat = $productsVat->add($productVat);
            $transportOnLinesHt = $transportOnLinesHt->add($lineTransportHt);
            $transportOnLinesVat = $transportOnLinesVat->add($lineTransportVat);

            $lines[] = new \App\Domain\Sales\DTO\CustomerInvoiceLineProjection(
                lineId: $line->lineId,
                productHt: $productHt,
                productVat: $productVat,
                productTtc: $productTtc,
                transportHt: $lineTransportHt,
                transportVat: $lineTransportVat,
                transportTtc: $transportTtc,
                totalHt: $lineTotalHt,
                totalVat: $lineTotalVat,
                totalTtc: $lineTotalTtc,
            );
        }

        $transportOrderFeeHt = $breakdown->transport->orderBreakdown->transportChargedAsOrderFeeHt;
        $transportOrderFeeVat = $breakdown->transportVat->subtract($transportOnLinesVat);
        $transportOrderFeeTtc = $transportOrderFeeHt->add($transportOrderFeeVat);

        $productsTtc = $productsHt->add($productsVat);
        $transportHt = $breakdown->transportHt;
        $transportVat = $breakdown->transportVat;
        $transportTtc = $transportHt->add($transportVat);

        $totalHt = $productsHt->add($transportHt);
        $totalVat = $productsVat->add($transportVat);
        $totalTtc = $totalHt->add($totalVat);

        if (
            $totalHt->minorAmount !== $breakdown->totalHt->minorAmount
            || $totalVat->minorAmount !== $breakdown->totalVat->minorAmount
            || $totalTtc->minorAmount !== $breakdown->totalTtc->minorAmount
        ) {
            throw new \DomainException('Customer invoice projection totals must match order breakdown totals.');
        }

        return new \App\Domain\Sales\DTO\CustomerInvoiceProjection(
            lines: $lines,
            productsHt: $productsHt,
            productsVat: $productsVat,
            productsTtc: $productsTtc,
            transportHt: $transportHt,
            transportVat: $transportVat,
            transportTtc: $transportTtc,
            transportOrderFeeHt: $transportOrderFeeHt,
            transportOrderFeeVat: $transportOrderFeeVat,
            transportOrderFeeTtc: $transportOrderFeeTtc,
            totalHt: $totalHt,
            totalVat: $totalVat,
            totalTtc: $totalTtc,
        );
    }
}
