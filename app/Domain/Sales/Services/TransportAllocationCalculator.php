<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\DTO\OrderTransportBreakdown;
use App\Domain\Sales\DTO\OrderTransportCalculationInput;
use App\Domain\Sales\DTO\TransportAllocation;
use App\Domain\Sales\DTO\TransportCalculationResult;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\ValueObjects\Money;

final class TransportAllocationCalculator
{
    public function calculate(OrderTransportCalculationInput $input): TransportCalculationResult
    {
        $currency = $input->transportRealHt->currency;

        $embeddedTotalMinor = 0;
        foreach ($input->lines as $line) {
            if ($line->transportEmbeddedHt->currency !== $currency) {
                throw new \DomainException('All transport amounts must share the same currency.');
            }
            $embeddedTotalMinor += $line->transportEmbeddedHt->minorAmount;
        }

        if ($embeddedTotalMinor > $input->transportRealHt->minorAmount) {
            throw new \DomainException('Embedded transport exceeds real transport amount.');
        }

        $remainingMinor = $input->transportRealHt->minorAmount - $embeddedTotalMinor;
        $weightsByLineId = $this->weightsByLineId($input);

        $additionalByLine = $input->presentationMode === TransportPresentationMode::RedistributeOnLines
            ? $this->allocateMinorByWeights($remainingMinor, $weightsByLineId)
            : $this->zeroAllocation($input);

        $economicByLine = $this->allocateMinorByWeights($input->transportRealHt->minorAmount, $weightsByLineId);

        $lineAllocations = [];
        $chargedOnLinesMinor = 0;
        $lineVatMinor = 0;

        foreach ($input->lines as $line) {
            $additionalMinor = $additionalByLine[$line->lineId] ?? 0;
            $chargedMinor = $line->transportEmbeddedHt->minorAmount + $additionalMinor;
            $chargedOnLinesMinor += $chargedMinor;

            $chargedMoney = new Money($chargedMinor, $currency);
            $vatMoney = $this->computeVat($chargedMoney, $input->transportVatRate->basisPoints);
            $lineVatMinor += $vatMoney->minorAmount;

            $lineAllocations[] = new TransportAllocation(
                lineId: $line->lineId,
                rollOccupancyBasisPoints: $line->rollOccupancyBasisPoints,
                transportEmbeddedHt: $line->transportEmbeddedHt,
                transportAdditionalHt: new Money($additionalMinor, $currency),
                transportTotalChargedHt: $chargedMoney,
                transportEconomicCostAllocatedHt: new Money($economicByLine[$line->lineId] ?? 0, $currency),
                transportVatRate: $input->transportVatRate,
                transportVatAmount: $vatMoney,
            );
        }

        $orderFeeMinor = $input->transportRealHt->minorAmount - $chargedOnLinesMinor;
        if ($orderFeeMinor < 0) {
            throw new \DomainException('Transport allocation exceeds real transport amount.');
        }

        $orderFeeVat = $this->computeVat(new Money($orderFeeMinor, $currency), $input->transportVatRate->basisPoints);
        $transportVatTotal = new Money($lineVatMinor + $orderFeeVat->minorAmount, $currency);

        if ($chargedOnLinesMinor + $orderFeeMinor !== $input->transportRealHt->minorAmount) {
            throw new \DomainException('Transport mass conservation violated.');
        }

        $breakdown = new OrderTransportBreakdown(
            carrierId: $input->carrierId,
            zoneId: $input->zoneId,
            rollCount: $input->rollCount,
            tariffGrossHt: $input->tariffGrossHt,
            minimumAppliedHt: $input->minimumAppliedHt,
            transportRealHt: $input->transportRealHt,
            transportEmbeddedInProductsHt: new Money($embeddedTotalMinor, $currency),
            transportRemainingHt: new Money($remainingMinor, $currency),
            transportChargedOnLinesHt: new Money($chargedOnLinesMinor, $currency),
            transportChargedAsOrderFeeHt: new Money($orderFeeMinor, $currency),
            transportVatRate: $input->transportVatRate,
            transportVatTotal: $transportVatTotal,
            transportTtc: $input->transportRealHt->add($transportVatTotal),
        );

        return new TransportCalculationResult($breakdown, $lineAllocations);
    }

    /**
     * @return array<int, int>
     */
    private function allocateMinorByWeights(int $minorAmount, array $weightsByLineId): array
    {
        $lineIds = array_keys($weightsByLineId);
        $allocations = [];

        foreach ($lineIds as $lineId) {
            $allocations[$lineId] = 0;
        }

        if ($minorAmount <= 0 || count($lineIds) === 0) {
            return $allocations;
        }

        $totalWeight = array_sum($weightsByLineId);
        if ($totalWeight <= 0) {
            foreach ($lineIds as $lineId) {
                $weightsByLineId[$lineId] = 1;
            }
            $totalWeight = count($lineIds);
        }

        $remainders = [];
        $allocated = 0;

        foreach ($weightsByLineId as $lineId => $weight) {
            $numerator = $minorAmount * $weight;
            $base = intdiv($numerator, $totalWeight);
            $remainder = $numerator % $totalWeight;

            $allocations[$lineId] = $base;
            $remainders[] = ['lineId' => $lineId, 'remainder' => $remainder];
            $allocated += $base;
        }

        $residual = $minorAmount - $allocated;
        usort($remainders, static function (array $a, array $b): int {
            if ($a['remainder'] === $b['remainder']) {
                return $a['lineId'] <=> $b['lineId'];
            }

            return $b['remainder'] <=> $a['remainder'];
        });

        for ($i = 0; $i < $residual; $i++) {
            $lineId = $remainders[$i]['lineId'];
            $allocations[$lineId]++;
        }

        return $allocations;
    }

    /**
     * @return array<int, int>
     */
    private function zeroAllocation(OrderTransportCalculationInput $input): array
    {
        $result = [];
        foreach ($input->lines as $line) {
            $result[$line->lineId] = 0;
        }

        return $result;
    }

    /**
     * @return array<int, int>
     */
    private function weightsByLineId(OrderTransportCalculationInput $input): array
    {
        $weights = [];
        foreach ($input->lines as $line) {
            $weights[$line->lineId] = $line->rollOccupancyBasisPoints;
        }

        return $weights;
    }

    private function computeVat(Money $baseHt, int $vatBasisPoints): Money
    {
        $num = $baseHt->minorAmount * $vatBasisPoints;
        $vatMinor = intdiv($num + 5_000, 10_000);

        return new Money($vatMinor, $baseHt->currency);
    }
}
