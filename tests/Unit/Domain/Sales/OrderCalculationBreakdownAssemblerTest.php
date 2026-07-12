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
use App\Domain\Sales\Services\OrderCalculationBreakdownAssembler;
use App\Domain\Sales\Services\TransportAllocationCalculator;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

it('assembles order totals from product lines and transport breakdown', function (): void {
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

    $line1 = buildSalesLine(1, 5000, 275, [
        new CalculationWarning(SalesCalculationWarningCode::MultipleConditionsFirstApplied, 'test warning'),
    ]);
    $line2 = buildSalesLine(2, 7500, 413, []);

    $breakdown = (new OrderCalculationBreakdownAssembler())->assemble([$line1, $line2], $transport);

    expect($breakdown->productsHt->minorAmount)->toBe(12_500)
        ->and($breakdown->productsVat->minorAmount)->toBe(688)
        ->and($breakdown->transportHt->minorAmount)->toBe(1000)
        ->and($breakdown->transportVat->minorAmount)->toBe(200)
        ->and($breakdown->totalHt->minorAmount)->toBe(13_500)
        ->and($breakdown->totalVat->minorAmount)->toBe(888)
        ->and($breakdown->totalTtc->minorAmount)->toBe(14_388)
        ->and(count($breakdown->warnings))->toBe(1);
});

it('throws when a line currency does not match transport currency', function (): void {
    $transport = (new TransportAllocationCalculator())->calculate(new OrderTransportCalculationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        tariffGrossHt: new Money(500, Currency::EUR),
        minimumAppliedHt: new Money(0, Currency::EUR),
        transportRealHt: new Money(500, Currency::EUR),
        transportVatRate: Percentage::fromString('20'),
        lines: [
            new TransportLineInput(1, 10000, new Money(500, Currency::EUR)),
        ],
    ));

    $usdLine = buildSalesLine(1, 1000, 55, [], Currency::USD);

    (new OrderCalculationBreakdownAssembler())->assemble([$usdLine], $transport);
})->throws(DomainException::class, 'Currency mismatch between product lines and transport breakdown.');

function buildSalesLine(int $lineId, int $lineHtMinor, int $vatMinor, array $warnings, Currency $currency = Currency::EUR): SalesLineBreakdown
{
    $component = new ProductComponentBreakdown(
        dbLineBaseHt: new Money($lineHtMinor, $currency),
        billingMarginLineHt: new Money(0, $currency),
        sellerMarginLineHt: new Money(0, $currency),
        discountPercentLineHt: new Money(0, $currency),
        discountFixedLineHt: new Money(0, $currency),
        finalLineHt: new Money($lineHtMinor, $currency),
        productVatRate: Percentage::fromString('5.5'),
        productVatLineAmount: new Money($vatMinor, $currency),
        finalLineTtc: new Money($lineHtMinor + $vatMinor, $currency),
        roundingRule: RoundingRule::LineHalfUpV1,
    );

    return new SalesLineBreakdown(
        lineId: $lineId,
        priceReference: new ProductPriceReference(
            productId: 100 + $lineId,
            dbProductId: 200 + $lineId,
            priceSource: PriceSourceType::Standard,
            baseUnitPriceHt: new Money(1000, $currency),
        ),
        product: $component,
        operations: [],
        actorEarnings: [],
        warnings: $warnings,
    );
}
