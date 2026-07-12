<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\OrderSalesCalculationInput;
use App\Domain\Sales\DTO\OrderSalesShadowBatchInput;
use App\Domain\Sales\DTO\OrderSalesShadowGateInput;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationEnvelope;
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

it('validates publication envelope when checksum and payload are consistent', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationEnvelopeBuilder';
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationEnvelopeVerifier';

    $builder = new $builderClass();
    $verifier = new $verifierClass();

    $envelope = $builder->build(publicationEnvelopeVerifierInput(), '2026-07-13T16:10:00Z', 'sha256');
    $verification = $verifier->verify($envelope);

    expect($verification->isValid)->toBeTrue()
        ->and($verification->errors)->toBe([])
        ->and($verification->expectedChecksum)->toBe($verification->actualChecksum)
        ->and($verification->algorithm)->toBe('sha256');
});

it('fails verification when publication envelope checksum is tampered', function (): void {
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationEnvelopeBuilder';
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationEnvelopeVerifier';

    $builder = new $builderClass();
    $verifier = new $verifierClass();

    $envelope = $builder->build(publicationEnvelopeVerifierInput(), '2026-07-13T16:15:00Z', 'sha256');

    $tampered = new OrderSalesShadowReleaseManifestPublicationEnvelope(
        generatedAtUtc: $envelope->generatedAtUtc,
        checksumAlgorithm: $envelope->checksumAlgorithm,
        checksum: str_repeat('0', 64),
        governanceResult: $envelope->governanceResult,
        governanceArray: $envelope->governanceArray,
        governanceJson: $envelope->governanceJson,
    );

    $verification = $verifier->verify($tampered);

    expect($verification->isValid)->toBeFalse()
        ->and($verification->errors)->toContain('Checksum mismatch between publication envelope and governance payload.');
});

function publicationEnvelopeVerifierInput()
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
                                orders: [buildPublicationEnvelopeVerifierOrderInput(1), buildPublicationEnvelopeVerifierOrderInput(2)],
                                generatedAtUtc: '2026-07-13T16:20:00Z',
                                maxWarningRatePercentForPromote: 50,
                                maxSkippedRatePercentForPromote: 100,
                                topIssuesLimit: 10,
                            ),
                            minimumOrdersForLimitedRollout: 1,
                            minimumOrdersForGeneralRollout: 5,
                        ),
                        planGeneratedAtUtc: '2026-07-13T16:25:00Z',
                        limitedStartPercent: 10,
                        limitedEndPercent: 50,
                        hoursPerStep: 12,
                    ),
                    packageGeneratedAtUtc: '2026-07-13T16:30:00Z',
                    envelopeGeneratedAtUtc: '2026-07-13T16:35:00Z',
                    checksumAlgorithm: 'sha256',
                ),
                executionPlanGeneratedAtUtc: '2026-07-13T16:40:00Z',
                executionPackageGeneratedAtUtc: '2026-07-13T16:45:00Z',
                readinessGeneratedAtUtc: '2026-07-13T16:50:00Z',
            ),
            manifestGeneratedAtUtc: '2026-07-13T16:55:00Z',
            schemaVersion: '1.0',
        ),
        packageGeneratedAtUtc: '2026-07-13T16:58:00Z',
        checksumAlgorithm: 'sha256',
    );
}

function buildPublicationEnvelopeVerifierOrderInput(int $lineId): OrderSalesCalculationInput
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
                    productId: 3700 + $lineId,
                    dbProductId: 3800 + $lineId,
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
        inputContext: ['batch' => 'shadow-release-manifest-publication-envelope-verifier-test'],
        generatedAtUtc: '2026-07-13T16:20:00Z',
    );
}
