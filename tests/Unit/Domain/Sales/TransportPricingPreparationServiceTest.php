<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\TransportPreparationInput;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\Services\TransportPricingPreparationService;
use App\Domain\Sales\ValueObjects\Money;

/**
 * Business Rules:
 * BR-032
 */
it('creates additional transport fee in separate mode', function (): void {
    $service = new TransportPricingPreparationService();

    $result = $service->prepare(new TransportPreparationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        transportRealHt: new Money(1000, Currency::EUR),
        transportEmbeddedInProductsHt: new Money(600, Currency::EUR),
        lineIds: [1, 2],
    ));

    expect($result->hasAdditionalTransportFee)->toBeTrue()
        ->and($result->transportAdditionalFeeHt->minorAmount)->toBe(400)
        ->and($result->transportEmbeddedInProductsHt->minorAmount)->toBe(600);
});

/**
 * Business Rules:
 * BR-032
 */
it('keeps the transport fee equal to the full transport cost when nothing is embedded', function (): void {
    $service = new TransportPricingPreparationService();

    $result = $service->prepare(new TransportPreparationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        transportRealHt: new Money(700, Currency::EUR),
        transportEmbeddedInProductsHt: new Money(0, Currency::EUR),
        lineIds: [1, 2],
    ));

    expect($result->hasAdditionalTransportFee)->toBeTrue()
        ->and($result->transportAdditionalFeeHt->minorAmount)->toBe(700)
        ->and($result->transportEmbeddedInProductsHt->minorAmount)->toBe(0);
});

it('caps additional transport fee to zero when embedded exceeds real', function (): void {
    $service = new TransportPricingPreparationService();

    $result = $service->prepare(new TransportPreparationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        transportRealHt: new Money(500, Currency::EUR),
        transportEmbeddedInProductsHt: new Money(700, Currency::EUR),
        lineIds: [1],
    ));

    expect($result->hasAdditionalTransportFee)->toBeFalse()
        ->and($result->transportAdditionalFeeHt->minorAmount)->toBe(0);
});

/**
 * Business Rules:
 * BR-030
 */
it('keeps the residual transport at zero when embedded transport equals real transport', function (): void {
    $service = new TransportPricingPreparationService();

    $result = $service->prepare(new TransportPreparationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        transportRealHt: new Money(700, Currency::EUR),
        transportEmbeddedInProductsHt: new Money(700, Currency::EUR),
        lineIds: [1, 2],
    ));

    expect($result->hasAdditionalTransportFee)->toBeFalse()
        ->and($result->transportAdditionalFeeHt->minorAmount)->toBe(0)
        ->and($result->transportEmbeddedInProductsHt->minorAmount)->toBe(700);
});

it('redistributes transport entirely on lines in redistribute mode', function (): void {
    $service = new TransportPricingPreparationService();

    $result = $service->prepare(new TransportPreparationInput(
        presentationMode: TransportPresentationMode::RedistributeOnLines,
        transportRealHt: new Money(1250, Currency::EUR),
        transportEmbeddedInProductsHt: new Money(300, Currency::EUR),
        lineIds: [1, 2, 3],
    ));

    expect($result->hasAdditionalTransportFee)->toBeFalse()
        ->and($result->transportAdditionalFeeHt->minorAmount)->toBe(0)
        ->and($result->transportEmbeddedInProductsHt->minorAmount)->toBe(1250);
});
