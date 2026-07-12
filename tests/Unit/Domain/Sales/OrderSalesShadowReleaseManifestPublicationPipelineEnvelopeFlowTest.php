<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\OrderSalesCalculationInput;
use App\Domain\Sales\DTO\OrderSalesShadowBatchInput;
use App\Domain\Sales\DTO\OrderSalesShadowGateInput;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelope;
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

it('builds publication pipeline envelope with stable checksum', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeBuilder';
    $builder = new $builderClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';

    $input = new $inputClass(
        pipelineInput: new $pipelineInputClass(
            packageInput: buildPublicationPipelineEnvelopePackageInput(1, 5),
            envelopeGeneratedAtUtc: '2026-07-13T21:00:00Z',
            pipelineGeneratedAtUtc: '2026-07-13T21:05:00Z',
            checksumAlgorithm: 'sha256',
        ),
        envelopeGeneratedAtUtc: '2026-07-13T21:10:00Z',
        checksumAlgorithm: 'sha256',
    );

    $envelopeA = $builder->build($input);
    $envelopeB = $builder->build($input);

    expect($envelopeA->checksumAlgorithm)->toBe('sha256')
        ->and($envelopeA->checksum)->toBe($envelopeB->checksum)
        ->and($envelopeA->pipelineResult->publicationResult->publicationDecision->action)->toBe('publish_manifest');
});

it('verifies publication pipeline envelope and detects checksum tampering', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeBuilder';
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerifier';

    $builder = new $builderClass();
    $verifier = new $verifierClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';

    $input = new $inputClass(
        pipelineInput: new $pipelineInputClass(
            packageInput: buildPublicationPipelineEnvelopePackageInput(1, 5),
            envelopeGeneratedAtUtc: '2026-07-13T21:12:00Z',
            pipelineGeneratedAtUtc: '2026-07-13T21:14:00Z',
            checksumAlgorithm: 'sha256',
        ),
        envelopeGeneratedAtUtc: '2026-07-13T21:16:00Z',
        checksumAlgorithm: 'sha256',
    );

    $envelope = $builder->build($input);
    $verification = $verifier->verify($envelope);

    expect($verification->isValid)->toBeTrue()
        ->and($verification->errors)->toBe([]);

    $tampered = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelope(
        generatedAtUtc: $envelope->generatedAtUtc,
        checksumAlgorithm: $envelope->checksumAlgorithm,
        checksum: str_repeat('0', 64),
        pipelineResult: $envelope->pipelineResult,
        pipelineArray: $envelope->pipelineArray,
        pipelineJson: $envelope->pipelineJson,
    );

    $tamperedVerification = $verifier->verify($tampered);

    expect($tamperedVerification->isValid)->toBeFalse()
        ->and($tamperedVerification->errors)->toContain('Checksum mismatch between publication pipeline envelope and pipeline payload.');
});

it('runs publication pipeline envelope and returns valid result', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeRunner';
    $runner = new $runnerClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';

    $result = $runner->run(new $inputClass(
        pipelineInput: new $pipelineInputClass(
            packageInput: buildPublicationPipelineEnvelopePackageInput(1, 5),
            envelopeGeneratedAtUtc: '2026-07-13T21:20:00Z',
            pipelineGeneratedAtUtc: '2026-07-13T21:22:00Z',
            checksumAlgorithm: 'sha256',
        ),
        envelopeGeneratedAtUtc: '2026-07-13T21:24:00Z',
        checksumAlgorithm: 'sha256',
    ));

    expect($result->envelope->checksumAlgorithm)->toBe('sha256')
        ->and($result->verification->isValid)->toBeTrue();
});

it('serializes publication pipeline envelope result to valid json', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeRunner';
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResultSerializer';

    $runner = new $runnerClass();
    $serializer = new $serializerClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';

    $result = $runner->run(new $inputClass(
        pipelineInput: new $pipelineInputClass(
            packageInput: buildPublicationPipelineEnvelopePackageInput(1, 5),
            envelopeGeneratedAtUtc: '2026-07-13T21:30:00Z',
            pipelineGeneratedAtUtc: '2026-07-13T21:32:00Z',
            checksumAlgorithm: 'sha256',
        ),
        envelopeGeneratedAtUtc: '2026-07-13T21:34:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $json = $serializer->toJson($result);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['envelope']['checksum_algorithm'])->toBe('sha256')
        ->and($decoded['verification']['is_valid'])->toBeTrue()
        ->and($decoded['envelope']['pipeline']['publication_result']['publication_decision']['action'])->toBe('publish_manifest');
});

function buildPublicationPipelineEnvelopePackageInput(int $minimumOrdersForLimitedRollout, int $minimumOrdersForGeneralRollout)
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
                                    buildPublicationPipelineEnvelopeOrderInput(1),
                                    buildPublicationPipelineEnvelopeOrderInput(2),
                                ],
                                generatedAtUtc: '2026-07-13T20:40:00Z',
                                maxWarningRatePercentForPromote: 50,
                                maxSkippedRatePercentForPromote: 100,
                                topIssuesLimit: 10,
                            ),
                            minimumOrdersForLimitedRollout: $minimumOrdersForLimitedRollout,
                            minimumOrdersForGeneralRollout: $minimumOrdersForGeneralRollout,
                        ),
                        planGeneratedAtUtc: '2026-07-13T20:42:00Z',
                        limitedStartPercent: 10,
                        limitedEndPercent: 50,
                        hoursPerStep: 12,
                    ),
                    packageGeneratedAtUtc: '2026-07-13T20:44:00Z',
                    envelopeGeneratedAtUtc: '2026-07-13T20:46:00Z',
                    checksumAlgorithm: 'sha256',
                ),
                executionPlanGeneratedAtUtc: '2026-07-13T20:48:00Z',
                executionPackageGeneratedAtUtc: '2026-07-13T20:50:00Z',
                readinessGeneratedAtUtc: '2026-07-13T20:52:00Z',
            ),
            manifestGeneratedAtUtc: '2026-07-13T20:54:00Z',
            schemaVersion: '1.0',
        ),
        packageGeneratedAtUtc: '2026-07-13T20:56:00Z',
        checksumAlgorithm: 'sha256',
    );
}

function buildPublicationPipelineEnvelopeOrderInput(int $lineId): OrderSalesCalculationInput
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
                    productId: 4900 + $lineId,
                    dbProductId: 5000 + $lineId,
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
        inputContext: ['batch' => 'shadow-release-manifest-publication-pipeline-envelope-flow-test'],
        generatedAtUtc: '2026-07-13T20:40:00Z',
    );
}
