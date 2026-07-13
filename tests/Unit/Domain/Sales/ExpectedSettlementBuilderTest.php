<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\ActorEarningBreakdown;
use App\Domain\Sales\DTO\OrderTransportCalculationInput;
use App\Domain\Sales\DTO\ProductComponentBreakdown;
use App\Domain\Sales\DTO\ProductPriceReference;
use App\Domain\Sales\DTO\SalesLineBreakdown;
use App\Domain\Sales\DTO\TransportLineInput;
use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\Enums\PriceSourceType;
use App\Domain\Sales\Enums\RoundingRule;
use App\Domain\Sales\Enums\SettlementReason;
use App\Domain\Sales\Enums\TaxTreatmentStatus;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\Services\ExpectedSettlementBuilder;
use App\Domain\Sales\Services\OrderCalculationBreakdownAssembler;
use App\Domain\Sales\Services\TransportAllocationCalculator;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

/**
 * Business Rules:
 * BR-051
 * BR-052
 * BR-053
 */
it('builds internal settlements for db base, seller net earning and transport', function (): void {
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
        carrierId: 77,
    ));

    $line1 = settlementLine(1, 3000, 5000, 275, 400);
    $line2 = settlementLine(2, 4500, 7500, 413, 600);

    $breakdown = (new OrderCalculationBreakdownAssembler())->assemble([$line1, $line2], $transport);

    $collection = (new ExpectedSettlementBuilder())->build($breakdown, new ActorChain(
        databaseOwnerId: 1,
        billingUserId: 2,
        sellerId: 3,
    ));

    expect(count($collection->lines))->toBe(3);

    $byReason = [];
    foreach ($collection->lines as $line) {
        $byReason[$line->reason->value] = $line;
    }

    expect($byReason[SettlementReason::ProductBaseSupply->value]->amountHt->minorAmount)->toBe(7500)
        ->and($byReason[SettlementReason::SellerNetEarning->value]->amountHt->minorAmount)->toBe(1000)
        ->and($byReason[SettlementReason::TransportCostRecovery->value]->amountHt->minorAmount)->toBe(1000)
        ->and($byReason[SettlementReason::ProductBaseSupply->value]->taxTreatmentStatus)->toBe(TaxTreatmentStatus::PendingConfiguration)
        ->and($byReason[SettlementReason::SellerNetEarning->value]->taxTreatmentStatus)->toBe(TaxTreatmentStatus::PendingConfiguration)
        ->and($byReason[SettlementReason::TransportCostRecovery->value]->taxTreatmentStatus)->toBe(TaxTreatmentStatus::PendingConfiguration);
});

/**
 * Business Rules:
 * BR-053
 */
it('skips self settlements and seller settlement when no seller is defined', function (): void {
    $transport = (new TransportAllocationCalculator())->calculate(new OrderTransportCalculationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        tariffGrossHt: new Money(0, Currency::EUR),
        minimumAppliedHt: new Money(0, Currency::EUR),
        transportRealHt: new Money(0, Currency::EUR),
        transportVatRate: Percentage::fromString('20'),
        lines: [new TransportLineInput(1, 10_000, new Money(0, Currency::EUR))],
    ));

    $line = settlementLine(1, 1000, 1200, 66, 0);
    $breakdown = (new OrderCalculationBreakdownAssembler())->assemble([$line], $transport);

    $collection = (new ExpectedSettlementBuilder())->build($breakdown, new ActorChain(
        databaseOwnerId: 2,
        billingUserId: 2,
        sellerId: null,
    ));

    expect($collection->lines)->toHaveCount(0);
});

/**
 * Business Rules:
 * BR-052
 */
it('creates a transport reversement line when transport cost is present and actors are distinct', function (): void {
    $transport = (new TransportAllocationCalculator())->calculate(new OrderTransportCalculationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        tariffGrossHt: new Money(750, Currency::EUR),
        minimumAppliedHt: new Money(0, Currency::EUR),
        transportRealHt: new Money(750, Currency::EUR),
        transportVatRate: Percentage::fromString('20'),
        lines: [new TransportLineInput(1, 10_000, new Money(750, Currency::EUR))],
        carrierId: 77,
    ));

    $line = settlementLine(1, 1000, 1200, 66, 0);
    $breakdown = (new OrderCalculationBreakdownAssembler())->assemble([$line], $transport);

    $collection = (new ExpectedSettlementBuilder())->build($breakdown, new ActorChain(
        databaseOwnerId: 10,
        billingUserId: 20,
        sellerId: null,
    ));

    expect($collection->lines)->toHaveCount(2)
        ->and($collection->lines[1]->reason)->toBe(SettlementReason::TransportCostRecovery)
        ->and($collection->lines[1]->amountHt->minorAmount)->toBe(750)
        ->and($collection->lines[1]->fromActorId)->toBe(20)
        ->and($collection->lines[1]->toActorType->value)->toBe('transporter')
        ->and($collection->lines[1]->toActorId)->toBe(77);
});

function settlementLine(int $lineId, int $dbBaseMinor, int $finalHtMinor, int $vatMinor, int $sellerNetMinor): SalesLineBreakdown
{
    $currency = Currency::EUR;

    return new SalesLineBreakdown(
        lineId: $lineId,
        priceReference: new ProductPriceReference(
            productId: 100 + $lineId,
            dbProductId: 200 + $lineId,
            priceSource: PriceSourceType::Standard,
            baseUnitPriceHt: new Money($dbBaseMinor, $currency),
        ),
        product: new ProductComponentBreakdown(
            dbLineBaseHt: new Money($dbBaseMinor, $currency),
            billingMarginLineHt: new Money(0, $currency),
            sellerMarginLineHt: new Money($sellerNetMinor, $currency),
            discountPercentLineHt: new Money(0, $currency),
            discountFixedLineHt: new Money(0, $currency),
            finalLineHt: new Money($finalHtMinor, $currency),
            productVatRate: Percentage::fromString('5.5'),
            productVatLineAmount: new Money($vatMinor, $currency),
            finalLineTtc: new Money($finalHtMinor + $vatMinor, $currency),
            roundingRule: RoundingRule::LineHalfUpV1,
        ),
        operations: [],
        actorEarnings: [
            new ActorEarningBreakdown(
                actorType: ActorType::BillingUser,
                actorId: 2,
                grossMarginHt: new Money(0, $currency),
                discountSupportedHt: new Money(0, $currency),
                netEarningHt: new Money(0, $currency),
            ),
            new ActorEarningBreakdown(
                actorType: ActorType::Seller,
                actorId: 3,
                grossMarginHt: new Money($sellerNetMinor, $currency),
                discountSupportedHt: new Money(0, $currency),
                netEarningHt: new Money($sellerNetMinor, $currency),
            ),
        ],
        warnings: [],
    );
}
