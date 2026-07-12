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

it('runs final publication and keeps publish_manifest decision when all checks pass', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationRunner';
    $runner = new $runnerClass();

    $result = $runner->run(
        input: buildPublicationRunnerInput(1, 5),
        envelopeGeneratedAtUtc: '2026-07-13T18:30:00Z',
        checksumAlgorithm: 'sha256',
    );

    expect($result->envelopeResult->verification->isValid)->toBeTrue()
        ->and($result->publicationDecision->action)->toBe('publish_manifest')
        ->and($result->publicationDecision->approved)->toBeTrue();
});

it('runs final publication and keeps hold_manifest_publication decision when release is on hold', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationRunner';
    $runner = new $runnerClass();

    $result = $runner->run(
        input: buildPublicationRunnerInput(999, 999),
        envelopeGeneratedAtUtc: '2026-07-13T18:35:00Z',
        checksumAlgorithm: 'sha256',
    );

    expect($result->envelopeResult->verification->isValid)->toBeTrue()
        ->and($result->publicationDecision->action)->toBe('hold_manifest_publication')
        ->and($result->publicationDecision->approved)->toBeFalse()
        ->and($result->publicationDecision->releaseAction)->toBe('hold_release');
});

function buildPublicationRunnerInput(int $minimumOrdersForLimitedRollout, int $minimumOrdersForGeneralRollout)
{
    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPackageInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPipelineInput';
    $readinessInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseReadinessInput';
    $releasePipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleasePipelineInput';
    $governanceInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceInput';

    return new $inputClass(
        manifestPipelineInput: new $pipelineInputClass(
            readinessInput: new $readinessInputClass(
                pipelineInput: new $releasePipelineInputClass(
                    governanceInput: new $governanceInputClass(
                        gateInput: new OrderSalesShadowGateInput(
                            batchInput: new OrderSalesShadowBatchInput(
                                orders: [
                                    buildPublicationRunnerOrderInput(1),
                                    buildPublicationRunnerOrderInput(2),
                                ],
                                generatedAtUtc: '2026-07-13T18:00:00Z',
                                maxWarningRatePercentForPromote: 50,
                                maxSkippedRatePercentForPromote: 100,
                                topIssuesLimit: 10,
                            ),
                            minimumOrdersForLimitedRollout: $minimumOrdersForLimitedRollout,
                            minimumOrdersForGeneralRollout: $minimumOrdersForGeneralRollout,
                        ),
                        planGeneratedAtUtc: '2026-07-13T18:05:00Z',
                        limitedStartPercent: 10,
                        limitedEndPercent: 50,
                        hoursPerStep: 12,
                    ),
                    packageGeneratedAtUtc: '2026-07-13T18:10:00Z',
                    envelopeGeneratedAtUtc: '2026-07-13T18:12:00Z',
                    checksumAlgorithm: 'sha256',
                ),
                executionPlanGeneratedAtUtc: '2026-07-13T18:14:00Z',
                executionPackageGeneratedAtUtc: '2026-07-13T18:16:00Z',
                readinessGeneratedAtUtc: '2026-07-13T18:18:00Z',
            ),
            manifestGeneratedAtUtc: '2026-07-13T18:20:00Z',
            schemaVersion: '1.0',
        ),
        packageGeneratedAtUtc: '2026-07-13T18:22:00Z',
        checksumAlgorithm: 'sha256',
    );
}

function buildPublicationRunnerOrderInput(int $lineId): OrderSalesCalculationInput
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
                    productId: 4300 + $lineId,
                    dbProductId: 4400 + $lineId,
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
        inputContext: ['batch' => 'shadow-release-manifest-publication-runner-test'],
        generatedAtUtc: '2026-07-13T18:00:00Z',
    );
}
