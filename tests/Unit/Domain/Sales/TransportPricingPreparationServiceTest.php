<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\TransportPreparationInput;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\Services\TransportPricingPreparationService;
use App\Domain\Sales\ValueObjects\Money;

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
