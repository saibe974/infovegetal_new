<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\OrderSalesCalculationInput;
use App\Domain\Sales\DTO\OrderSalesShadowBatchInput;
use App\Domain\Sales\DTO\OrderSalesShadowGateInput;
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
use App\Domain\Sales\Enums\ShadowModePromotionDecision;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;
use App\Domain\Sales\ValueObjects\Quantity;

it('runs governance flow and returns gate plus rollout plan', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceRunner';
    $runner = new $runnerClass();

    $governanceInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceInput';

    $result = $runner->run(new $governanceInputClass(
        gateInput: new OrderSalesShadowGateInput(
            batchInput: new OrderSalesShadowBatchInput(
                orders: [
                    buildGovernanceOrderInput(1),
                    buildGovernanceOrderInput(2),
                ],
                generatedAtUtc: '2026-07-12T22:00:00Z',
                maxWarningRatePercentForPromote: 50,
                maxSkippedRatePercentForPromote: 100,
                topIssuesLimit: 10,
            ),
            minimumOrdersForLimitedRollout: 1,
            minimumOrdersForGeneralRollout: 5,
        ),
        planGeneratedAtUtc: '2026-07-12T22:05:00Z',
        limitedStartPercent: 10,
        limitedEndPercent: 50,
        hoursPerStep: 12,
    ));

    expect($result->gateResult->batchResult->report->summary->promotionDecision)
        ->toBe(ShadowModePromotionDecision::Promote)
        ->and($result->gateResult->gateDecision->action)->toBe('enable_limited_rollout')
        ->and($result->rolloutPlan->generatedAtUtc)->toBe('2026-07-12T22:05:00Z')
        ->and($result->rolloutPlan->recommendedAction)->toBe('enable_limited_rollout')
        ->and(count($result->rolloutPlan->steps))->toBe(3)
        ->and($result->rolloutPlan->steps[0]->trafficPercent)->toBe(10)
        ->and($result->rolloutPlan->steps[1]->trafficPercent)->toBe(50);
});

function buildGovernanceOrderInput(int $lineId): OrderSalesCalculationInput
{
    $actorChain = new ActorChain(databaseOwnerId: 1, billingUserId: 2, sellerId: 3);

    $conditions = new ResolvedConditionCollection([
        new ResolvedCondition(
            id: 'billing_margin_' . $lineId,
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::BillingUser,
            sourceActorId: 2,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: Percentage::fromString('10'),
            priority: 1,
        ),
        new ResolvedCondition(
            id: 'seller_margin_' . $lineId,
            type: ConditionType::MarginPercent,
            sourceActorType: ActorType::Seller,
            sourceActorId: 3,
            scope: ApplicationScope::Line,
            baseType: CalculationBaseType::DbLineBaseHt,
            percentageValue: Percentage::fromString('15'),
            priority: 1,
        ),
    ]);

    return new OrderSalesCalculationInput(
        lineInputs: [
            new LineCalculationInput(
                lineId: $lineId,
                priceReference: new ProductPriceReference(
                    productId: 500 + $lineId,
                    dbProductId: 600 + $lineId,
                    priceSource: PriceSourceType::Standard,
                    baseUnitPriceHt: new Money(10_000, Currency::EUR),
                ),
                quantity: Quantity::fromInt(2),
                actorChain: $actorChain,
                conditions: $conditions,
                taxContext: new ProductTaxContext(Percentage::fromString('5.5')),
                salesMode: SalesMode::Depart,
            ),
        ],
        transportInput: new OrderTransportCalculationInput(
            presentationMode: TransportPresentationMode::SeparateAdditionalFee,
            tariffGrossHt: new Money(300, Currency::EUR),
            minimumAppliedHt: new Money(0, Currency::EUR),
            transportRealHt: new Money(300, Currency::EUR),
            transportVatRate: Percentage::fromString('20'),
            lines: [new TransportLineInput($lineId, 10_000, new Money(0, Currency::EUR))],
        ),
        inputContext: ['batch' => 'shadow-governance-test'],
        generatedAtUtc: '2026-07-12T22:00:00Z',
    );
}
