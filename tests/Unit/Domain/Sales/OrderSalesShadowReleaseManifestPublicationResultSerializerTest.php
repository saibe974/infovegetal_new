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

it('serializes final publication result to deterministic array', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationResultSerializer';
    $serializer = new $serializerClass();

    $result = publicationResultSerializerValue();
    $array = $serializer->toArray($result);

    expect($array['envelope_result']['verification']['is_valid'])->toBeTrue()
        ->and($array['publication_decision']['action'])->toBe('publish_manifest')
        ->and($array['publication_decision']['release_action'])->toBe('approve_release');
});

it('serializes final publication result to valid json', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationResultSerializer';
    $serializer = new $serializerClass();

    $result = publicationResultSerializerValue();
    $json = $serializer->toJson($result);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['publication_decision']['approved'])->toBeTrue()
        ->and($decoded['envelope_result']['envelope']['checksum_algorithm'])->toBe('sha256')
        ->and($decoded['envelope_result']['envelope']['governance']['publication_decision']['action'])->toBe('publish_manifest');
});

function publicationResultSerializerValue()
{
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationRunner';
    $runner = new $runnerClass();

    return $runner->run(
        input: publicationResultSerializerInput(),
        envelopeGeneratedAtUtc: '2026-07-13T19:00:00Z',
        checksumAlgorithm: 'sha256',
    );
}

function publicationResultSerializerInput()
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
                                    buildPublicationResultSerializerOrderInput(1),
                                    buildPublicationResultSerializerOrderInput(2),
                                ],
                                generatedAtUtc: '2026-07-13T18:40:00Z',
                                maxWarningRatePercentForPromote: 50,
                                maxSkippedRatePercentForPromote: 100,
                                topIssuesLimit: 10,
                            ),
                            minimumOrdersForLimitedRollout: 1,
                            minimumOrdersForGeneralRollout: 5,
                        ),
                        planGeneratedAtUtc: '2026-07-13T18:42:00Z',
                        limitedStartPercent: 10,
                        limitedEndPercent: 50,
                        hoursPerStep: 12,
                    ),
                    packageGeneratedAtUtc: '2026-07-13T18:44:00Z',
                    envelopeGeneratedAtUtc: '2026-07-13T18:46:00Z',
                    checksumAlgorithm: 'sha256',
                ),
                executionPlanGeneratedAtUtc: '2026-07-13T18:48:00Z',
                executionPackageGeneratedAtUtc: '2026-07-13T18:50:00Z',
                readinessGeneratedAtUtc: '2026-07-13T18:52:00Z',
            ),
            manifestGeneratedAtUtc: '2026-07-13T18:54:00Z',
            schemaVersion: '1.0',
        ),
        packageGeneratedAtUtc: '2026-07-13T18:56:00Z',
        checksumAlgorithm: 'sha256',
    );
}

function buildPublicationResultSerializerOrderInput(int $lineId): OrderSalesCalculationInput
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
                    productId: 4500 + $lineId,
                    dbProductId: 4600 + $lineId,
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
        inputContext: ['batch' => 'shadow-release-manifest-publication-result-serializer-test'],
        generatedAtUtc: '2026-07-13T18:40:00Z',
    );
}
