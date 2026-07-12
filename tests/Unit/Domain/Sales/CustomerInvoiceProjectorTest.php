<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\CalculationWarning;
use App\Domain\Sales\DTO\OrderTransportCalculationInput;
use App\Domain\Sales\DTO\ProductComponentBreakdown;
use App\Domain\Sales\DTO\ProductPriceReference;
use App\Domain\Sales\DTO\SalesLineBreakdown;
use App\Domain\Sales\DTO\TransportLineInput;
use App\Domain\Sales\Enums\PriceSourceType;
use App\Domain\Sales\Enums\RoundingRule;
use App\Domain\Sales\Enums\SalesCalculationWarningCode;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\Services\CustomerInvoiceProjector;
use App\Domain\Sales\Services\OrderCalculationBreakdownAssembler;
use App\Domain\Sales\Services\TransportAllocationCalculator;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

it('projects customer invoice totals and line transport split', function (): void {
    $transport = (new TransportAllocationCalculator())->calculate(new OrderTransportCalculationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        tariffGrossHt: new Money(1000, Currency::EUR),
        minimumAppliedHt: new Money(0, Currency::EUR),
        transportRealHt: new Money(1000, Currency::EUR),
        transportVatRate: Percentage::fromString('20'),
        lines: [
            new TransportLineInput(1, 6000, new Money(250, Currency::EUR)),
            new TransportLineInput(2, 4000, new Money(150, Currency::EUR)),
        ],
    ));

    $line1 = buildProjectionLine(1, 5000, 275, [
        new CalculationWarning(SalesCalculationWarningCode::MultipleConditionsFirstApplied, 'test warning'),
    ]);
    $line2 = buildProjectionLine(2, 7500, 413, []);

    $breakdown = (new OrderCalculationBreakdownAssembler())->assemble([$line1, $line2], $transport);
    $invoice = (new CustomerInvoiceProjector())->project($breakdown);

    expect($invoice->productsHt->minorAmount)->toBe(12_500)
        ->and($invoice->productsVat->minorAmount)->toBe(688)
        ->and($invoice->transportHt->minorAmount)->toBe(1000)
        ->and($invoice->transportVat->minorAmount)->toBe(200)
        ->and($invoice->transportOrderFeeHt->minorAmount)->toBe(600)
        ->and($invoice->transportOrderFeeVat->minorAmount)->toBe(120)
        ->and($invoice->totalHt->minorAmount)->toBe(13_500)
        ->and($invoice->totalVat->minorAmount)->toBe(888)
        ->and($invoice->totalTtc->minorAmount)->toBe(14_388)
        ->and($invoice->lines[0]->transportHt->minorAmount)->toBe(250)
        ->and($invoice->lines[1]->transportHt->minorAmount)->toBe(150);
});

it('throws when breakdown totals are inconsistent', function (): void {
    $transport = (new TransportAllocationCalculator())->calculate(new OrderTransportCalculationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        tariffGrossHt: new Money(100, Currency::EUR),
        minimumAppliedHt: new Money(0, Currency::EUR),
        transportRealHt: new Money(100, Currency::EUR),
        transportVatRate: Percentage::fromString('20'),
        lines: [new TransportLineInput(1, 10_000, new Money(100, Currency::EUR))],
    ));

    $line = buildProjectionLine(1, 1000, 55, []);
    $breakdown = (new OrderCalculationBreakdownAssembler())->assemble([$line], $transport);

    $brokenBreakdown = new \App\Domain\Sales\DTO\OrderCalculationBreakdown(
        lines: $breakdown->lines,
        transport: $breakdown->transport,
        productsHt: $breakdown->productsHt,
        productsVat: $breakdown->productsVat,
        transportHt: $breakdown->transportHt,
        transportVat: $breakdown->transportVat,
        totalHt: new Money($breakdown->totalHt->minorAmount + 1, Currency::EUR),
        totalVat: $breakdown->totalVat,
        totalTtc: $breakdown->totalTtc,
        warnings: $breakdown->warnings,
    );

    (new CustomerInvoiceProjector())->project($brokenBreakdown);
})->throws(DomainException::class, 'Customer invoice projection totals must match order breakdown totals.');

function buildProjectionLine(int $lineId, int $lineHtMinor, int $vatMinor, array $warnings): SalesLineBreakdown
{
    $component = new ProductComponentBreakdown(
        dbLineBaseHt: new Money($lineHtMinor, Currency::EUR),
        billingMarginLineHt: new Money(0, Currency::EUR),
        sellerMarginLineHt: new Money(0, Currency::EUR),
        discountPercentLineHt: new Money(0, Currency::EUR),
        discountFixedLineHt: new Money(0, Currency::EUR),
        finalLineHt: new Money($lineHtMinor, Currency::EUR),
        productVatRate: Percentage::fromString('5.5'),
        productVatLineAmount: new Money($vatMinor, Currency::EUR),
        finalLineTtc: new Money($lineHtMinor + $vatMinor, Currency::EUR),
        roundingRule: RoundingRule::LineHalfUpV1,
    );

    return new SalesLineBreakdown(
        lineId: $lineId,
        priceReference: new ProductPriceReference(
            productId: 100 + $lineId,
            dbProductId: 200 + $lineId,
            priceSource: PriceSourceType::Standard,
            baseUnitPriceHt: new Money(1000, Currency::EUR),
        ),
        product: $component,
        operations: [],
        actorEarnings: [],
        warnings: $warnings,
    );
}
