<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderTransportCalculationInput;
use App\Domain\Sales\DTO\TransportLineInput;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\Services\TransportAllocationCalculator;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

/**
 * Business Rules:
 * BR-028
 */
it('keeps additional transport as order fee in separate mode', function (): void {
    $calculator = new TransportAllocationCalculator();

    $result = $calculator->calculate(new OrderTransportCalculationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        tariffGrossHt: new Money(1000, Currency::EUR),
        minimumAppliedHt: new Money(0, Currency::EUR),
        transportRealHt: new Money(1000, Currency::EUR),
        transportVatRate: Percentage::fromString('20'),
        lines: [
            new TransportLineInput(1, 7000, new Money(300, Currency::EUR)),
            new TransportLineInput(2, 3000, new Money(200, Currency::EUR)),
        ],
        carrierId: 10,
        zoneId: 20,
        rollCount: 12,
    ));

    expect($result->orderBreakdown->transportEmbeddedInProductsHt->minorAmount)->toBe(500)
        ->and($result->orderBreakdown->transportRemainingHt->minorAmount)->toBe(500)
        ->and($result->orderBreakdown->transportChargedOnLinesHt->minorAmount)->toBe(500)
        ->and($result->orderBreakdown->transportChargedAsOrderFeeHt->minorAmount)->toBe(500);

    expect($result->lineAllocations[0]->transportAdditionalHt->minorAmount)->toBe(0)
        ->and($result->lineAllocations[1]->transportAdditionalHt->minorAmount)->toBe(0);
});

/**
 * Business Rules:
 * BR-028
 */
it('keeps transport vat at zero when the transport vat rate is zero', function (): void {
    $calculator = new TransportAllocationCalculator();

    $result = $calculator->calculate(new OrderTransportCalculationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        tariffGrossHt: new Money(1000, Currency::EUR),
        minimumAppliedHt: new Money(0, Currency::EUR),
        transportRealHt: new Money(1000, Currency::EUR),
        transportVatRate: Percentage::fromString('0'),
        lines: [
            new TransportLineInput(1, 7000, new Money(300, Currency::EUR)),
            new TransportLineInput(2, 3000, new Money(200, Currency::EUR)),
        ],
        carrierId: 10,
        zoneId: 20,
        rollCount: 12,
    ));

    expect($result->orderBreakdown->transportVatTotal->minorAmount)->toBe(0)
        ->and($result->orderBreakdown->transportTtc->minorAmount)->toBe(1000)
        ->and($result->lineAllocations[0]->transportVatAmount->minorAmount)->toBe(0)
        ->and($result->lineAllocations[1]->transportVatAmount->minorAmount)->toBe(0);
});

it('redistributes remaining transport on lines in redistribute mode', function (): void {
    $calculator = new TransportAllocationCalculator();

    $result = $calculator->calculate(new OrderTransportCalculationInput(
        presentationMode: TransportPresentationMode::RedistributeOnLines,
        tariffGrossHt: new Money(1000, Currency::EUR),
        minimumAppliedHt: new Money(0, Currency::EUR),
        transportRealHt: new Money(1000, Currency::EUR),
        transportVatRate: Percentage::fromString('20'),
        lines: [
            new TransportLineInput(1, 7000, new Money(300, Currency::EUR)),
            new TransportLineInput(2, 3000, new Money(200, Currency::EUR)),
        ],
    ));

    expect($result->lineAllocations[0]->transportAdditionalHt->minorAmount)->toBe(350)
        ->and($result->lineAllocations[1]->transportAdditionalHt->minorAmount)->toBe(150)
        ->and($result->lineAllocations[0]->transportTotalChargedHt->minorAmount)->toBe(650)
        ->and($result->lineAllocations[1]->transportTotalChargedHt->minorAmount)->toBe(350)
        ->and($result->orderBreakdown->transportChargedAsOrderFeeHt->minorAmount)->toBe(0)
        ->and($result->orderBreakdown->transportChargedOnLinesHt->minorAmount)->toBe(1000);
});

it('uses deterministic tie-break on residual cent allocation by smallest line id', function (): void {
    $calculator = new TransportAllocationCalculator();

    $result = $calculator->calculate(new OrderTransportCalculationInput(
        presentationMode: TransportPresentationMode::RedistributeOnLines,
        tariffGrossHt: new Money(1, Currency::EUR),
        minimumAppliedHt: new Money(0, Currency::EUR),
        transportRealHt: new Money(1, Currency::EUR),
        transportVatRate: Percentage::fromString('20'),
        lines: [
            new TransportLineInput(10, 1, new Money(0, Currency::EUR)),
            new TransportLineInput(5, 1, new Money(0, Currency::EUR)),
        ],
    ));

    $byId = [];
    foreach ($result->lineAllocations as $allocation) {
        $byId[$allocation->lineId] = $allocation;
    }

    expect($byId[5]->transportAdditionalHt->minorAmount)->toBe(1)
        ->and($byId[10]->transportAdditionalHt->minorAmount)->toBe(0)
        ->and($result->orderBreakdown->transportChargedOnLinesHt->minorAmount)->toBe(1)
        ->and($result->orderBreakdown->transportChargedAsOrderFeeHt->minorAmount)->toBe(0);
});
