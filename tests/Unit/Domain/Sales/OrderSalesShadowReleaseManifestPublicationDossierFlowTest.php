<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\OrderSalesCalculationInput;
use App\Domain\Sales\DTO\OrderSalesShadowBatchInput;
use App\Domain\Sales\DTO\OrderSalesShadowGateInput;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDossier;
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

it('builds publication dossier with stable checksum', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationDossierBuilder';
    $builder = new $builderClass();

    $dossierA = $builder->build(buildPublicationDossierInput('2026-07-13T23:00:00Z'));
    $dossierB = $builder->build(buildPublicationDossierInput('2026-07-13T23:01:00Z'));

    expect($dossierA->checksumAlgorithm)->toBe('sha256')
        ->and($dossierA->checksum)->toBe($dossierB->checksum)
        ->and($dossierA->governanceResult->publicationDecision->action)->toBe('publish_manifest');
});

it('verifies dossier and detects checksum tampering', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationDossierBuilder';
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationDossierVerifier';

    $builder = new $builderClass();
    $verifier = new $verifierClass();

    $dossier = $builder->build(buildPublicationDossierInput('2026-07-13T23:10:00Z'));
    $verification = $verifier->verify($dossier);

    expect($verification->isValid)->toBeTrue()
        ->and($verification->errors)->toBe([]);

    $tampered = new OrderSalesShadowReleaseManifestPublicationDossier(
        generatedAtUtc: $dossier->generatedAtUtc,
        checksumAlgorithm: $dossier->checksumAlgorithm,
        checksum: str_repeat('0', 64),
        governanceResult: $dossier->governanceResult,
        governanceVerification: $dossier->governanceVerification,
        governanceArray: $dossier->governanceArray,
        governanceJson: $dossier->governanceJson,
    );

    $tamperedVerification = $verifier->verify($tampered);

    expect($tamperedVerification->isValid)->toBeFalse()
        ->and($tamperedVerification->errors)->toContain('Checksum mismatch between dossier and governance payload.');
});

it('runs dossier flow and serializes deterministic payload', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationDossierRunner';
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationDossierResultSerializer';

    $runner = new $runnerClass();
    $serializer = new $serializerClass();

    $result = $runner->run(buildPublicationDossierInput('2026-07-13T23:20:00Z'));
    $array = $serializer->toArray($result);
    $json = $serializer->toJson($result);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($result->verification->isValid)->toBeTrue()
        ->and($array['dossier']['checksum_algorithm'])->toBe('sha256')
        ->and($decoded['dossier']['governance']['result']['publication_decision']['action'])->toBe('publish_manifest');
});

function buildPublicationDossierInput(string $dossierGeneratedAtUtc)
{
    $dossierInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDossierInput';
    $envelopeInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';

    return new $dossierInputClass(
        governanceInput: new $envelopeInputClass(
            pipelineInput: new $pipelineInputClass(
                packageInput: buildPublicationDossierPackageInput(1, 5),
                envelopeGeneratedAtUtc: '2026-07-13T22:40:00Z',
                pipelineGeneratedAtUtc: '2026-07-13T22:42:00Z',
                checksumAlgorithm: 'sha256',
            ),
            envelopeGeneratedAtUtc: '2026-07-13T22:44:00Z',
            checksumAlgorithm: 'sha256',
        ),
        dossierGeneratedAtUtc: $dossierGeneratedAtUtc,
        checksumAlgorithm: 'sha256',
    );
}

function buildPublicationDossierPackageInput(int $minimumOrdersForLimitedRollout, int $minimumOrdersForGeneralRollout)
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
                                    buildPublicationDossierOrderInput(1),
                                    buildPublicationDossierOrderInput(2),
                                ],
                                generatedAtUtc: '2026-07-13T22:00:00Z',
                                maxWarningRatePercentForPromote: 50,
                                maxSkippedRatePercentForPromote: 100,
                                topIssuesLimit: 10,
                            ),
                            minimumOrdersForLimitedRollout: $minimumOrdersForLimitedRollout,
                            minimumOrdersForGeneralRollout: $minimumOrdersForGeneralRollout,
                        ),
                        planGeneratedAtUtc: '2026-07-13T22:05:00Z',
                        limitedStartPercent: 10,
                        limitedEndPercent: 50,
                        hoursPerStep: 12,
                    ),
                    packageGeneratedAtUtc: '2026-07-13T22:10:00Z',
                    envelopeGeneratedAtUtc: '2026-07-13T22:12:00Z',
                    checksumAlgorithm: 'sha256',
                ),
                executionPlanGeneratedAtUtc: '2026-07-13T22:14:00Z',
                executionPackageGeneratedAtUtc: '2026-07-13T22:16:00Z',
                readinessGeneratedAtUtc: '2026-07-13T22:18:00Z',
            ),
            manifestGeneratedAtUtc: '2026-07-13T22:20:00Z',
            schemaVersion: '1.0',
        ),
        packageGeneratedAtUtc: '2026-07-13T22:22:00Z',
        checksumAlgorithm: 'sha256',
    );
}

function buildPublicationDossierOrderInput(int $lineId): OrderSalesCalculationInput
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
                    productId: 5100 + $lineId,
                    dbProductId: 5200 + $lineId,
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
        inputContext: ['batch' => 'shadow-release-manifest-publication-dossier-flow-test'],
        generatedAtUtc: '2026-07-13T22:00:00Z',
    );
}
