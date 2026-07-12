<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\LegacyLineReference;
use App\Domain\Sales\DTO\LegacyOrderReference;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\OrderSalesCalculationInput;
use App\Domain\Sales\DTO\OrderTransportCalculationInput;
use App\Domain\Sales\DTO\ProductPriceReference;
use App\Domain\Sales\DTO\ProductTaxContext;
use App\Domain\Sales\DTO\ResolvedCondition;
use App\Domain\Sales\DTO\ResolvedConditionCollection;
use App\Domain\Sales\DTO\TransportLineInput;
use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\Enums\ApplicationScope;
use App\Domain\Sales\Enums\CalculationBaseType;
use App\Domain\Sales\Enums\ConditionType;
use App\Domain\Sales\Enums\PriceSourceType;
use App\Domain\Sales\Enums\SalesMode;
use App\Domain\Sales\Enums\ShadowModeStatus;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\Services\OrderSalesChainCalculator;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;
use App\Domain\Sales\ValueObjects\Quantity;

it('computes full chain result with snapshot and optional legacy comparison', function (): void {
    $lineInput = buildLineInput(lineId: 1, actorChain: new ActorChain(1, 2, 3));

    $calculator = new OrderSalesChainCalculator();

    $firstRun = $calculator->calculate(new OrderSalesCalculationInput(
        lineInputs: [$lineInput],
        transportInput: new OrderTransportCalculationInput(
            presentationMode: TransportPresentationMode::SeparateAdditionalFee,
            tariffGrossHt: new Money(400, Currency::EUR),
            minimumAppliedHt: new Money(0, Currency::EUR),
            transportRealHt: new Money(400, Currency::EUR),
            transportVatRate: Percentage::fromString('20'),
            lines: [new TransportLineInput(1, 10_000, new Money(0, Currency::EUR))],
        ),
        inputContext: ['source' => 'unit-test'],
        generatedAtUtc: '2026-07-12T12:00:00Z',
    ));

    $legacy = new LegacyOrderReference(
        totalHt: $firstRun->customerInvoice->totalHt,
        totalVat: $firstRun->customerInvoice->totalVat,
        totalTtc: $firstRun->customerInvoice->totalTtc,
        lines: array_map(
            static fn ($line) => new LegacyLineReference($line->lineId, $line->totalHt, $line->totalVat, $line->totalTtc),
            $firstRun->customerInvoice->lines
        ),
    );

    $secondRun = $calculator->calculate(new OrderSalesCalculationInput(
        lineInputs: [$lineInput],
        transportInput: new OrderTransportCalculationInput(
            presentationMode: TransportPresentationMode::SeparateAdditionalFee,
            tariffGrossHt: new Money(400, Currency::EUR),
            minimumAppliedHt: new Money(0, Currency::EUR),
            transportRealHt: new Money(400, Currency::EUR),
            transportVatRate: Percentage::fromString('20'),
            lines: [new TransportLineInput(1, 10_000, new Money(0, Currency::EUR))],
        ),
        inputContext: ['source' => 'unit-test'],
        generatedAtUtc: '2026-07-12T12:00:00Z',
        legacyReference: $legacy,
        comparisonToleranceMinor: 0,
    ));

    expect($secondRun->orderBreakdown->totalHt->minorAmount)->toBeGreaterThan(0)
        ->and($secondRun->customerInvoice->totalTtc->minorAmount)->toBeGreaterThan(0)
        ->and(count($secondRun->expectedSettlements->lines))->toBeGreaterThan(0)
        ->and($secondRun->snapshot->checksum)->toBeString()
        ->and($secondRun->legacyComparisonReport)->not->toBeNull()
        ->and($secondRun->legacyComparisonReport->isEquivalent)->toBeTrue()
        ->and($secondRun->shadowModeEvaluation->status)->toBe(ShadowModeStatus::Pass);
});

it('throws when line inputs do not share the same actor chain', function (): void {
    $calculator = new OrderSalesChainCalculator();

    $lineA = buildLineInput(lineId: 1, actorChain: new ActorChain(1, 2, 3));
    $lineB = buildLineInput(lineId: 2, actorChain: new ActorChain(1, 99, 3));

    $calculator->calculate(new OrderSalesCalculationInput(
        lineInputs: [$lineA, $lineB],
        transportInput: new OrderTransportCalculationInput(
            presentationMode: TransportPresentationMode::SeparateAdditionalFee,
            tariffGrossHt: new Money(200, Currency::EUR),
            minimumAppliedHt: new Money(0, Currency::EUR),
            transportRealHt: new Money(200, Currency::EUR),
            transportVatRate: Percentage::fromString('20'),
            lines: [
                new TransportLineInput(1, 5000, new Money(0, Currency::EUR)),
                new TransportLineInput(2, 5000, new Money(0, Currency::EUR)),
            ],
        ),
        inputContext: [],
        generatedAtUtc: '2026-07-12T12:00:00Z',
    ));
})->throws(DomainException::class, 'All line inputs must share the same actor chain');

function buildLineInput(int $lineId, ActorChain $actorChain): LineCalculationInput
{
    $conditions = new ResolvedConditionCollection([
        new ResolvedCondition(
            id: 'billing_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::BillingUser,
            sourceActorId: $actorChain->billingUserId,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: Percentage::fromString('10'),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::Seller,
            sourceActorId: $actorChain->sellerId ?? 0,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: Percentage::fromString('15'),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_discount_percent',
            type: ConditionType::DiscountPercent,
            sourceActorType: ActorType::Seller,
            sourceActorId: $actorChain->sellerId ?? 0,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::CommercialSubtotalLineHt,
            percentageValue: Percentage::fromString('5'),
            priority: 1,
        ),
    ]);

    return new LineCalculationInput(
        lineId: $lineId,
        priceReference: new ProductPriceReference(
            productId: 100 + $lineId,
            dbProductId: 200 + $lineId,
            priceSource: PriceSourceType::Standard,
            baseUnitPriceHt: new Money(10_000, Currency::EUR),
        ),
        quantity: Quantity::fromInt(2),
        actorChain: $actorChain,
        conditions: $conditions,
        taxContext: new ProductTaxContext(Percentage::fromString('5.5')),
        salesMode: SalesMode::Depart,
    );
}
