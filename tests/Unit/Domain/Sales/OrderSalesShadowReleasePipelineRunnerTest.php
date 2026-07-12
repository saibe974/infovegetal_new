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
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;
use App\Domain\Sales\ValueObjects\Quantity;

it('runs full release pipeline and returns approved decision when integrity and gate are valid', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleasePipelineRunner';
    $runner = new $runnerClass();

    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleasePipelineInput';
    $governanceInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceInput';

    $result = $runner->run(new $pipelineInputClass(
        governanceInput: new $governanceInputClass(
            gateInput: new OrderSalesShadowGateInput(
                batchInput: new OrderSalesShadowBatchInput(
                    orders: [
                        buildPipelineOrderInput(1),
                        buildPipelineOrderInput(2),
                    ],
                    generatedAtUtc: '2026-07-13T00:50:00Z',
                    maxWarningRatePercentForPromote: 50,
                    maxSkippedRatePercentForPromote: 100,
                    topIssuesLimit: 10,
                ),
                minimumOrdersForLimitedRollout: 1,
                minimumOrdersForGeneralRollout: 5,
            ),
            planGeneratedAtUtc: '2026-07-13T00:55:00Z',
            limitedStartPercent: 10,
            limitedEndPercent: 50,
            hoursPerStep: 12,
        ),
        packageGeneratedAtUtc: '2026-07-13T01:00:00Z',
        envelopeGeneratedAtUtc: '2026-07-13T01:05:00Z',
        checksumAlgorithm: 'sha256',
    ));

    expect($result->verification->isValid)->toBeTrue()
        ->and($result->releaseDecision->approved)->toBeTrue()
        ->and($result->releaseDecision->action)->toBe('approve_release')
        ->and($result->releaseDecision->rolloutAction)->toBe('enable_limited_rollout')
        ->and($result->envelope->checksumAlgorithm)->toBe('sha256');
});

function buildPipelineOrderInput(int $lineId): OrderSalesCalculationInput
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
                    productId: 1100 + $lineId,
                    dbProductId: 1200 + $lineId,
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
        inputContext: ['batch' => 'shadow-release-pipeline-test'],
        generatedAtUtc: '2026-07-13T00:50:00Z',
    );
}
