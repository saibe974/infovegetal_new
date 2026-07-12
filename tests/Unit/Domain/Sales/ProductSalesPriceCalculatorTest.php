<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\ProductPriceReference;
use App\Domain\Sales\DTO\ProductTaxContext;
use App\Domain\Sales\DTO\ResolvedCondition;
use App\Domain\Sales\DTO\ResolvedConditionCollection;
use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\Enums\ApplicationScope;
use App\Domain\Sales\Enums\CalculationBaseType;
use App\Domain\Sales\Enums\ConditionType;
use App\Domain\Sales\Enums\PriceSourceType;
use App\Domain\Sales\Enums\SalesMode;
use App\Domain\Sales\Exceptions\DiscountExceedsActorMarginException;
use App\Domain\Sales\Services\ProductSalesPriceCalculator;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;
use App\Domain\Sales\ValueObjects\Quantity;

function baseInput(ResolvedConditionCollection $conditions): LineCalculationInput
{
    return new LineCalculationInput(
        lineId: 1,
        priceReference: new ProductPriceReference(
            productId: 10,
            dbProductId: 20,
            priceSource: PriceSourceType::Standard,
            baseUnitPriceHt: new Money(10_000, Currency::EUR), // 100.00
        ),
        quantity: Quantity::fromInt(2),
        actorChain: new ActorChain(databaseOwnerId: 100, billingUserId: 200, sellerId: 300),
        conditions: $conditions,
        taxContext: new ProductTaxContext(new Percentage(550)),
        salesMode: SalesMode::Depart,
    );
}

it('calculates line without seller margin (db 100 qty2 billing 10 vat 5.5)', function () {
    $conditions = new ResolvedConditionCollection([
        new ResolvedCondition(
            id: 'billing_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::BillingUser,
            sourceActorId: 200,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1000),
            priority: 1,
        ),
    ]);

    $input = baseInput($conditions);
    $input = new LineCalculationInput(
        lineId: $input->lineId,
        priceReference: $input->priceReference,
        quantity: $input->quantity,
        actorChain: new ActorChain(databaseOwnerId: 100, billingUserId: 200, sellerId: null),
        conditions: $input->conditions,
        taxContext: $input->taxContext,
        salesMode: $input->salesMode,
    );

    $calculator = new ProductSalesPriceCalculator();
    $result = $calculator->calculate($input);

    expect($result->product->finalLineHt->minorAmount)->toBe(22_000)
        ->and($result->product->productVatLineAmount->minorAmount)->toBe(1_210)
        ->and($result->product->finalLineTtc->minorAmount)->toBe(23_210)
        ->and($result->actorEarnings[0]->netEarningHt->minorAmount)->toBe(2_000);
});

it('calculates line with billing and seller margins on db base', function () {
    $conditions = new ResolvedConditionCollection([
        new ResolvedCondition(
            id: 'billing_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::BillingUser,
            sourceActorId: 200,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1000),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::Seller,
            sourceActorId: 300,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1500),
            priority: 1,
        ),
    ]);

    $calculator = new ProductSalesPriceCalculator();
    $result = $calculator->calculate(baseInput($conditions));

    expect($result->product->finalLineHt->minorAmount)->toBe(25_000)
        ->and($result->product->billingMarginLineHt->minorAmount)->toBe(2_000)
        ->and($result->product->sellerMarginLineHt->minorAmount)->toBe(3_000);
});

it('calculates commercial percent discount on subtotal and updates seller net earning', function () {
    $conditions = new ResolvedConditionCollection([
        new ResolvedCondition(
            id: 'billing_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::BillingUser,
            sourceActorId: 200,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1000),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::Seller,
            sourceActorId: 300,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1500),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_discount_percent',
            type: ConditionType::DiscountPercent,
            sourceActorType: ActorType::Seller,
            sourceActorId: 300,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::CommercialSubtotalLineHt,
            percentageValue: new Percentage(500),
            priority: 1,
        ),
    ]);

    $calculator = new ProductSalesPriceCalculator();
    $result = $calculator->calculate(baseInput($conditions));

    expect($result->product->dbLineBaseHt->minorAmount)->toBe(20_000)
        ->and($result->product->discountPercentLineHt->minorAmount)->toBe(1_250)
        ->and($result->product->finalLineHt->minorAmount)->toBe(23_750)
        ->and($result->actorEarnings[0]->netEarningHt->minorAmount)->toBe(2_000)
        ->and($result->actorEarnings[1]->netEarningHt->minorAmount)->toBe(1_750);
});

it('applies fixed discount with line scope without creating unit discount in domain output', function () {
    $conditions = new ResolvedConditionCollection([
        new ResolvedCondition(
            id: 'billing_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::BillingUser,
            sourceActorId: 200,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1000),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::Seller,
            sourceActorId: 300,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1500),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_discount_fixed_line',
            type: ConditionType::DiscountFixed,
            sourceActorType: ActorType::Seller,
            sourceActorId: 300,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::CommercialSubtotalLineHt,
            moneyValue: new Money(800, Currency::EUR),
            priority: 1,
        ),
    ]);

    $calculator = new ProductSalesPriceCalculator();
    $result = $calculator->calculate(baseInput($conditions));

    expect($result->product->finalLineHt->minorAmount)->toBe(24_200)
        ->and($result->product->discountFixedLineHt->minorAmount)->toBe(800)
        ->and($result->actorEarnings[1]->netEarningHt->minorAmount)->toBe(2_200);
});

it('throws when commercial discount exceeds commercial gross margin', function () {
    $conditions = new ResolvedConditionCollection([
        new ResolvedCondition(
            id: 'billing_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::BillingUser,
            sourceActorId: 200,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1000),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::Seller,
            sourceActorId: 300,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1500),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_discount_fixed_line',
            type: ConditionType::DiscountFixed,
            sourceActorType: ActorType::Seller,
            sourceActorId: 300,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::CommercialSubtotalLineHt,
            moneyValue: new Money(3_500, Currency::EUR),
            priority: 1,
        ),
    ]);

    $calculator = new ProductSalesPriceCalculator();

    expect(fn () => $calculator->calculate(baseInput($conditions)))
        ->toThrow(DiscountExceedsActorMarginException::class);
});

it('calculates vat on final rounded line ht', function () {
    $conditions = new ResolvedConditionCollection([
        new ResolvedCondition(
            id: 'billing_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::BillingUser,
            sourceActorId: 200,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1000),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_margin',
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::Seller,
            sourceActorId: 300,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: new Percentage(1500),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_discount_percent',
            type: ConditionType::DiscountPercent,
            sourceActorType: ActorType::Seller,
            sourceActorId: 300,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::CommercialSubtotalLineHt,
            percentageValue: new Percentage(500),
            priority: 1,
        ),
    ]);

    $calculator = new ProductSalesPriceCalculator();
    $result = $calculator->calculate(baseInput($conditions));

    expect($result->product->finalLineHt->minorAmount)->toBe(23_750)
        ->and($result->product->productVatLineAmount->minorAmount)->toBe(1_306)
        ->and($result->product->finalLineTtc->minorAmount)->toBe(25_056);
});
