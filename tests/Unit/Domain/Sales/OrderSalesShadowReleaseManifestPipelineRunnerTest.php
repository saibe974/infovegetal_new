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

it('runs manifest pipeline end-to-end and returns a valid manifest verification', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPipelineRunner';
    $runner = new $runnerClass();

    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPipelineInput';
    $readinessInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseReadinessInput';
    $releasePipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleasePipelineInput';
    $governanceInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceInput';

    $result = $runner->run(new $pipelineInputClass(
        readinessInput: new $readinessInputClass(
            pipelineInput: new $releasePipelineInputClass(
                governanceInput: new $governanceInputClass(
                    gateInput: new OrderSalesShadowGateInput(
                        batchInput: new OrderSalesShadowBatchInput(
                            orders: [
                                buildManifestPipelineOrderInput(1),
                                buildManifestPipelineOrderInput(2),
                            ],
                            generatedAtUtc: '2026-07-13T05:20:00Z',
                            maxWarningRatePercentForPromote: 50,
                            maxSkippedRatePercentForPromote: 100,
                            topIssuesLimit: 10,
                        ),
                        minimumOrdersForLimitedRollout: 1,
                        minimumOrdersForGeneralRollout: 5,
                    ),
                    planGeneratedAtUtc: '2026-07-13T05:25:00Z',
                    limitedStartPercent: 10,
                    limitedEndPercent: 50,
                    hoursPerStep: 12,
                ),
                packageGeneratedAtUtc: '2026-07-13T05:30:00Z',
                envelopeGeneratedAtUtc: '2026-07-13T05:35:00Z',
                checksumAlgorithm: 'sha256',
            ),
            executionPlanGeneratedAtUtc: '2026-07-13T05:40:00Z',
            executionPackageGeneratedAtUtc: '2026-07-13T05:45:00Z',
            readinessGeneratedAtUtc: '2026-07-13T05:50:00Z',
        ),
        manifestGeneratedAtUtc: '2026-07-13T05:55:00Z',
        schemaVersion: '1.0',
    ));

    expect($result->readinessResult->readinessReport->status)->toBe('ready')
        ->and($result->manifest->schemaVersion)->toBe('1.0')
        ->and($result->manifest->releaseAction)->toBe('approve_release')
        ->and($result->manifestVerification->isValid)->toBeTrue();
});

function buildManifestPipelineOrderInput(int $lineId): OrderSalesCalculationInput
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
                    productId: 1700 + $lineId,
                    dbProductId: 1800 + $lineId,
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
        inputContext: ['batch' => 'shadow-release-manifest-pipeline-test'],
        generatedAtUtc: '2026-07-13T05:20:00Z',
    );
}
