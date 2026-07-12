<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\OrderSalesCalculationInput;
use App\Domain\Sales\DTO\OrderSalesShadowBatchInput;
use App\Domain\Sales\DTO\OrderSalesShadowGateInput;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageResult;
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

it('approves manifest publication when package verification is valid and release action is approve_release', function (): void {
    $assessorClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationAssessor';
    $assessor = new $assessorClass();

    $result = makeManifestPackageResultForAssessor('approve_release', true);
    $decision = $assessor->assess($result);

    expect($decision->approved)->toBeTrue()
        ->and($decision->action)->toBe('publish_manifest')
        ->and($decision->integrityVerified)->toBeTrue();
});

it('holds manifest publication when release action is hold_release', function (): void {
    $assessorClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationAssessor';
    $assessor = new $assessorClass();

    $result = makeManifestPackageResultForAssessor('hold_release', true);
    $decision = $assessor->assess($result);

    expect($decision->approved)->toBeFalse()
        ->and($decision->action)->toBe('hold_manifest_publication')
        ->and($decision->releaseAction)->toBe('hold_release');
});

it('rejects manifest publication when package verification fails', function (): void {
    $assessorClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationAssessor';
    $assessor = new $assessorClass();

    $result = makeManifestPackageResultForAssessor('approve_release', false);
    $decision = $assessor->assess($result);

    expect($decision->approved)->toBeFalse()
        ->and($decision->action)->toBe('reject_manifest_publication')
        ->and($decision->integrityVerified)->toBeFalse()
        ->and($decision->reasons)->toContain('Manifest package verification failed.');
});

function makeManifestPackageResultForAssessor(string $releaseAction, bool $valid): OrderSalesShadowReleaseManifestPackageResult
{
    $builderClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPackageBuilder';
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPackageVerifier';

    $builder = new $builderClass();
    $verifier = new $verifierClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPackageInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPipelineInput';
    $readinessInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseReadinessInput';
    $releasePipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleasePipelineInput';
    $governanceInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceInput';

    $package = $builder->build(new $inputClass(
        manifestPipelineInput: new $pipelineInputClass(
            readinessInput: new $readinessInputClass(
                pipelineInput: new $releasePipelineInputClass(
                    governanceInput: new $governanceInputClass(
                        gateInput: new OrderSalesShadowGateInput(
                            batchInput: new OrderSalesShadowBatchInput(
                                orders: [buildManifestPublicationAssessorOrderInput(1), buildManifestPublicationAssessorOrderInput(2)],
                                generatedAtUtc: '2026-07-13T12:20:00Z',
                                maxWarningRatePercentForPromote: 50,
                                maxSkippedRatePercentForPromote: 100,
                                topIssuesLimit: 10,
                            ),
                            minimumOrdersForLimitedRollout: $releaseAction === 'approve_release' ? 1 : 999,
                            minimumOrdersForGeneralRollout: 999,
                        ),
                        planGeneratedAtUtc: '2026-07-13T12:25:00Z',
                        limitedStartPercent: 10,
                        limitedEndPercent: 50,
                        hoursPerStep: 12,
                    ),
                    packageGeneratedAtUtc: '2026-07-13T12:30:00Z',
                    envelopeGeneratedAtUtc: '2026-07-13T12:35:00Z',
                    checksumAlgorithm: 'sha256',
                ),
                executionPlanGeneratedAtUtc: '2026-07-13T12:40:00Z',
                executionPackageGeneratedAtUtc: '2026-07-13T12:45:00Z',
                readinessGeneratedAtUtc: '2026-07-13T12:50:00Z',
            ),
            manifestGeneratedAtUtc: '2026-07-13T12:55:00Z',
            schemaVersion: '1.0',
        ),
        packageGeneratedAtUtc: '2026-07-13T13:00:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $verification = $verifier->verify($package);

    if (!$valid) {
        $verificationClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPackageVerification';
        $verification = new $verificationClass(
            isValid: false,
            expectedChecksum: $verification->expectedChecksum,
            actualChecksum: str_repeat('0', 64),
            algorithm: 'sha256',
            errors: ['checksum does not match manifestPipelineJson payload hash.'],
        );
    }

    $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPackageResult';

    return new $resultClass(
        package: $package,
        verification: $verification,
    );
}

function buildManifestPublicationAssessorOrderInput(int $lineId): OrderSalesCalculationInput
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
                    productId: 3100 + $lineId,
                    dbProductId: 3200 + $lineId,
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
        inputContext: ['batch' => 'shadow-release-manifest-publication-assessor-test'],
        generatedAtUtc: '2026-07-13T12:20:00Z',
    );
}
