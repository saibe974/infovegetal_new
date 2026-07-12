<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\DTO\ActorEarningBreakdown;
use App\Domain\Sales\DTO\CalculationOperation;
use App\Domain\Sales\DTO\CalculationWarning;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\ProductComponentBreakdown;
use App\Domain\Sales\DTO\ResolvedCondition;
use App\Domain\Sales\DTO\SalesLineBreakdown;
use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\Enums\ApplicationScope;
use App\Domain\Sales\Enums\CalculationBaseType;
use App\Domain\Sales\Enums\ConditionType;
use App\Domain\Sales\Enums\RoundingRule;
use App\Domain\Sales\Enums\SalesCalculationWarningCode;
use App\Domain\Sales\Exceptions\DiscountExceedsActorMarginException;
use App\Domain\Sales\Exceptions\MissingBasePriceException;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\PreciseAmount;

final class ProductSalesPriceCalculator
{
    public function calculate(LineCalculationInput $input): SalesLineBreakdown
    {
        $currency = $input->priceReference->baseUnitPriceHt->currency;
        if ($input->priceReference->baseUnitPriceHt->minorAmount <= 0) {
            throw new MissingBasePriceException('Base DB unit price must be strictly positive.');
        }

        $operations = [];
        $warnings = [];

        $dbBaseLinePrecise = PreciseAmount::fromMoney($input->priceReference->baseUnitPriceHt)
            ->multiplyByQuantity($input->quantity);
        $dbBaseLine = $dbBaseLinePrecise->toMoney();

        $billingMarginCondition = $input->conditions->first(ConditionType::MarginPercent, ActorType::BillingUser);
        $sellerMarginCondition = $input->conditions->first(ConditionType::MarginPercent, ActorType::Seller);

        if (count($input->conditions->ofType(ConditionType::MarginPercent)) > 2) {
            $warnings[] = new CalculationWarning(
                SalesCalculationWarningCode::MultipleConditionsFirstApplied,
                'Multiple margin percent conditions detected. Only first by priority per actor is applied.'
            );
        }

        $billingMarginPrecise = $billingMarginCondition?->percentageValue
            ? $dbBaseLinePrecise->multiplyByPercentage($billingMarginCondition->percentageValue)
            : PreciseAmount::zero($currency);

        $sellerMarginPrecise = $sellerMarginCondition?->percentageValue
            ? $dbBaseLinePrecise->multiplyByPercentage($sellerMarginCondition->percentageValue)
            : PreciseAmount::zero($currency);

        $subtotalPrecise = $dbBaseLinePrecise->add($billingMarginPrecise)->add($sellerMarginPrecise);

        $discountPercentCondition = $input->conditions->first(ConditionType::DiscountPercent, ActorType::Seller);
        $discountFixedCondition = $input->conditions->first(ConditionType::DiscountFixed, ActorType::Seller);

        $discountPercentPrecise = $discountPercentCondition?->percentageValue
            ? $subtotalPrecise->multiplyByPercentage($discountPercentCondition->percentageValue)
            : PreciseAmount::zero($currency);

        $discountFixedPrecise = $this->resolveFixedDiscountPrecise($discountFixedCondition, $input, $warnings);

        $sellerSupportedDiscountPrecise = $discountPercentPrecise->add($discountFixedPrecise);

        if ($sellerSupportedDiscountPrecise->rawAmount > $sellerMarginPrecise->rawAmount) {
            throw new DiscountExceedsActorMarginException('Discount exceeds seller gross margin.');
        }

        $finalLineHtPrecise = $subtotalPrecise
            ->subtract($discountPercentPrecise)
            ->subtract($discountFixedPrecise);

        $finalLineHt = $finalLineHtPrecise->toMoney(RoundingRule::LineHalfUpV1);
        $vatPrecise = PreciseAmount::fromMoney($finalLineHt)->multiplyByPercentage($input->taxContext->vatRate);
        $vatLine = $vatPrecise->toMoney(RoundingRule::LineHalfUpV1);
        $finalLineTtc = $finalLineHt->add($vatLine);

        $operations[] = $this->operationFrom(
            'billing_margin',
            $billingMarginCondition,
            CalculationBaseType::DbLineBaseHt,
            $dbBaseLine,
            $billingMarginPrecise->toMoney(),
            $dbBaseLine->add($billingMarginPrecise->toMoney()),
            'margin_on_db_line_v1'
        );

        $operations[] = $this->operationFrom(
            'seller_margin',
            $sellerMarginCondition,
            CalculationBaseType::DbLineBaseHt,
            $dbBaseLine,
            $sellerMarginPrecise->toMoney(),
            $dbBaseLine->add($billingMarginPrecise->toMoney())->add($sellerMarginPrecise->toMoney()),
            'margin_on_db_line_v1'
        );

        $operations[] = $this->operationFrom(
            'seller_discount_percent',
            $discountPercentCondition,
            CalculationBaseType::CommercialSubtotalLineHt,
            $subtotalPrecise->toMoney(),
            $discountPercentPrecise->toMoney(),
            $subtotalPrecise->subtract($discountPercentPrecise)->toMoney(),
            'discount_percent_on_subtotal_v1'
        );

        $operations[] = $this->operationFrom(
            'seller_discount_fixed',
            $discountFixedCondition,
            CalculationBaseType::CommercialSubtotalLineHt,
            $subtotalPrecise->subtract($discountPercentPrecise)->toMoney(),
            $discountFixedPrecise->toMoney(),
            $finalLineHt,
            'discount_fixed_scope_v1'
        );

        $operations[] = new CalculationOperation(
            operationType: 'product_vat',
            sourceConditionId: null,
            baseType: CalculationBaseType::FinalLineHt,
            inputAmount: $finalLineHt,
            calculatedAmount: $vatLine,
            outputAmount: $finalLineTtc,
            formulaId: 'line_vat_on_final_ht_v1'
        );

        $billingGross = $billingMarginPrecise->toMoney();
        $sellerGross = $sellerMarginPrecise->toMoney();
        $sellerDiscount = $sellerSupportedDiscountPrecise->toMoney();

        $actorEarnings = [
            new ActorEarningBreakdown(
                actorType: ActorType::BillingUser,
                actorId: $input->actorChain->billingUserId,
                grossMarginHt: $billingGross,
                discountSupportedHt: Money::zero($currency),
                netEarningHt: $billingGross,
            ),
        ];

        if ($input->actorChain->sellerId !== null) {
            $actorEarnings[] = new ActorEarningBreakdown(
                actorType: ActorType::Seller,
                actorId: $input->actorChain->sellerId,
                grossMarginHt: $sellerGross,
                discountSupportedHt: $sellerDiscount,
                netEarningHt: $sellerGross->subtract($sellerDiscount),
            );
        }

        $product = new ProductComponentBreakdown(
            dbLineBaseHt: $dbBaseLine,
            billingMarginLineHt: $billingGross,
            sellerMarginLineHt: $sellerGross,
            discountPercentLineHt: $discountPercentPrecise->toMoney(),
            discountFixedLineHt: $discountFixedPrecise->toMoney(),
            finalLineHt: $finalLineHt,
            productVatRate: $input->taxContext->vatRate,
            productVatLineAmount: $vatLine,
            finalLineTtc: $finalLineTtc,
            roundingRule: RoundingRule::LineHalfUpV1,
        );

        return new SalesLineBreakdown(
            lineId: $input->lineId,
            priceReference: $input->priceReference,
            product: $product,
            operations: $operations,
            actorEarnings: $actorEarnings,
            warnings: $warnings,
        );
    }

    /**
     * @param list<CalculationWarning> $warnings
     */
    private function resolveFixedDiscountPrecise(?ResolvedCondition $condition, LineCalculationInput $input, array &$warnings): PreciseAmount
    {
        $currency = $input->priceReference->baseUnitPriceHt->currency;

        if (!$condition || !$condition->moneyValue) {
            return PreciseAmount::zero($currency);
        }

        if ($condition->scope === ApplicationScope::Unit) {
            return PreciseAmount::fromMoney($condition->moneyValue)
                ->multiplyByQuantity($input->quantity);
        }

        if ($condition->scope === ApplicationScope::Line) {
            return PreciseAmount::fromMoney($condition->moneyValue);
        }

        $warnings[] = new CalculationWarning(
            SalesCalculationWarningCode::UnsupportedOrderScopedConditionIgnored,
            'Order-scoped fixed discount is ignored at line level.'
        );

        return PreciseAmount::zero($currency);
    }

    private function operationFrom(
        string $operationType,
        ?ResolvedCondition $condition,
        CalculationBaseType $baseType,
        Money $inputAmount,
        Money $calculatedAmount,
        Money $outputAmount,
        string $formulaId,
    ): CalculationOperation {
        return new CalculationOperation(
            operationType: $operationType,
            sourceConditionId: $condition?->id,
            baseType: $baseType,
            inputAmount: $inputAmount,
            calculatedAmount: $calculatedAmount,
            outputAmount: $outputAmount,
            formulaId: $formulaId,
        );
    }
}
