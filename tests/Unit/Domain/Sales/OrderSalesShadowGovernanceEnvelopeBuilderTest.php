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

it('builds governance envelope with sha256 checksum from package json', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceEnvelopeBuilder';
    $builder = new $builderClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceInput';

    $envelope = $builder->build(
        input: new $inputClass(
            gateInput: new OrderSalesShadowGateInput(
                batchInput: new OrderSalesShadowBatchInput(
                    orders: [
                        buildEnvelopeOrderInput(1),
                        buildEnvelopeOrderInput(2),
                    ],
                    generatedAtUtc: '2026-07-12T23:40:00Z',
                    maxWarningRatePercentForPromote: 50,
                    maxSkippedRatePercentForPromote: 100,
                    topIssuesLimit: 10,
                ),
                minimumOrdersForLimitedRollout: 1,
                minimumOrdersForGeneralRollout: 5,
            ),
            planGeneratedAtUtc: '2026-07-12T23:45:00Z',
            limitedStartPercent: 10,
            limitedEndPercent: 50,
            hoursPerStep: 12,
        ),
        packageGeneratedAtUtc: '2026-07-12T23:50:00Z',
        envelopeGeneratedAtUtc: '2026-07-12T23:55:00Z',
    );

    expect($envelope->checksumAlgorithm)->toBe('sha256')
        ->and($envelope->checksum)->toBe(hash('sha256', $envelope->package->governanceJson))
        ->and($envelope->generatedAtUtc)->toBe('2026-07-12T23:55:00Z');
});

it('rejects unsupported checksum algorithm', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowGovernanceEnvelopeBuilder';
    $builder = new $builderClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceInput';

    expect(fn () => $builder->build(
        input: new $inputClass(
            gateInput: new OrderSalesShadowGateInput(
                batchInput: new OrderSalesShadowBatchInput(
                    orders: [buildEnvelopeOrderInput(1)],
                    generatedAtUtc: '2026-07-12T23:40:00Z',
                ),
            ),
            planGeneratedAtUtc: '2026-07-12T23:45:00Z',
        ),
        packageGeneratedAtUtc: '2026-07-12T23:50:00Z',
        envelopeGeneratedAtUtc: '2026-07-12T23:55:00Z',
        checksumAlgorithm: 'sha1',
    ))->toThrow(\InvalidArgumentException::class);
});

function buildEnvelopeOrderInput(int $lineId): OrderSalesCalculationInput
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
                    productId: 900 + $lineId,
                    dbProductId: 1000 + $lineId,
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
        inputContext: ['batch' => 'shadow-governance-envelope-test'],
        generatedAtUtc: '2026-07-12T23:40:00Z',
    );
}
