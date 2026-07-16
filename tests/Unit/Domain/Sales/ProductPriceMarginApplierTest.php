<?php

declare(strict_types=1);

use App\Domain\Sales\Services\ProductPriceMarginApplier;

/**
 * Business Rules:
 * BR-014
 * BR-015
 * BR-016
 * BR-017
 */
it('applies the final margin percentage on the base unit price', function () {
    $applier = new ProductPriceMarginApplier();

    $adjustedPrice = $applier->apply(
        baseUnitPrice: 10.0,
        tierMarginPercent: 0.0,
        finalMarginPercent: 10.0,
        minimumMarginPerUnit: 0.0,
        deliveryPerUnit: 0.0,
        weightingPercent: 0.0,
        priceMode: 0,
    );

    expect($adjustedPrice)->toBe(11.0);
});

/**
 * Business Rules:
 * BR-014
 * BR-015
 * BR-016
 */
it('applies the tier margin before the final margin on the same base unit price', function () {
    $applier = new ProductPriceMarginApplier();

    $adjustedPrice = $applier->apply(
        baseUnitPrice: 10.0,
        tierMarginPercent: 20.0,
        finalMarginPercent: 10.0,
        minimumMarginPerUnit: 0.0,
        deliveryPerUnit: 0.0,
        weightingPercent: 0.0,
        priceMode: 0,
    );

    expect($adjustedPrice)->toBe(13.0);
});

/**
 * Business Rules:
 * BR-014
 * BR-015
 * BR-016
 * BR-017
 */
it('keeps zero prices unchanged when no base unit price exists', function () {
    $applier = new ProductPriceMarginApplier();

    $adjustedPrice = $applier->apply(
        baseUnitPrice: 0.0,
        tierMarginPercent: 20.0,
        finalMarginPercent: 10.0,
        minimumMarginPerUnit: 1.0,
        deliveryPerUnit: 2.0,
        weightingPercent: 5.0,
        priceMode: 1,
    );

    expect($adjustedPrice)->toBe(0.0);
});

/**
 * Business Rules:
 * BR-016
 */
it('applies the minimum margin per unit when it is higher than the tier percentage margin', function () {
    $applier = new ProductPriceMarginApplier();

    $adjustedPrice = $applier->apply(
        baseUnitPrice: 10.0,
        tierMarginPercent: 1.0,
        finalMarginPercent: 0.0,
        minimumMarginPerUnit: 2.0,
        deliveryPerUnit: 0.0,
        weightingPercent: 0.0,
        priceMode: 0,
    );

    expect($adjustedPrice)->toBe(12.0);
});

/**
 * Business Rules:
 * BR-017
 */
it('applies the weighting coefficient after the tier margin and before the final margin', function () {
    $applier = new ProductPriceMarginApplier();

    $adjustedPrice = $applier->apply(
        baseUnitPrice: 10.0,
        tierMarginPercent: 20.0,
        finalMarginPercent: 10.0,
        minimumMarginPerUnit: 0.0,
        deliveryPerUnit: 0.0,
        weightingPercent: 10.0,
        priceMode: 0,
    );

    expect(round($adjustedPrice, 2))->toBe(14.33);
});