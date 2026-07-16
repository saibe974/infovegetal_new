<?php

declare(strict_types=1);

use App\Domain\Sales\Services\ProductVolumePriceSelector;

/**
 * Business Rules:
 * BR-002
 * BR-003
 * BR-005
 * BR-006
 */
it('keeps the standard unit price at the carton threshold', function () {
    $selector = new ProductVolumePriceSelector();

    $unitPrice = $selector->selectUnitPrice(
        quantity: 4,
        traySize: 4,
        floorSize: 12,
        rollSize: 24,
        standardUnitPrice: 10.0,
        floorUnitPrice: 8.0,
        rollUnitPrice: 7.0,
        promoUnitPrice: 6.0,
    );

    expect($unitPrice)->toBe(10.0);
});

/**
 * Business Rules:
 * BR-003
 */
it('keeps the carton price below the floor threshold', function () {
    $selector = new ProductVolumePriceSelector();

    $unitPrice = $selector->selectUnitPrice(
        quantity: 11,
        traySize: 4,
        floorSize: 12,
        rollSize: 24,
        standardUnitPrice: 10.0,
        floorUnitPrice: 8.0,
        rollUnitPrice: 7.0,
        promoUnitPrice: 6.0,
    );

    expect($unitPrice)->toBe(10.0);
});

/**
 * Business Rules:
 * BR-003
 */
it('applies the floor unit price at the floor threshold', function () {
    $selector = new ProductVolumePriceSelector();

    $unitPrice = $selector->selectUnitPrice(
        quantity: 12,
        traySize: 4,
        floorSize: 12,
        rollSize: 24,
        standardUnitPrice: 10.0,
        floorUnitPrice: 8.0,
        rollUnitPrice: 7.0,
        promoUnitPrice: 6.0,
    );

    expect($unitPrice)->toBe(8.0);
});

/**
 * Business Rules:
 * BR-003
 */
it('falls back to the standard unit price when the floor threshold is invalid', function () {
    $selector = new ProductVolumePriceSelector();

    $unitPrice = $selector->selectUnitPrice(
        quantity: 12,
        traySize: 4,
        floorSize: 0,
        rollSize: 24,
        standardUnitPrice: 10.0,
        floorUnitPrice: 8.0,
        rollUnitPrice: 7.0,
        promoUnitPrice: 6.0,
    );

    expect($unitPrice)->toBe(10.0);
});

/**
 * Business Rules:
 * BR-005
 */
it('applies the roll unit price at the roll threshold when no promo is active', function () {
    $selector = new ProductVolumePriceSelector();

    $unitPrice = $selector->selectUnitPrice(
        quantity: 24,
        traySize: 4,
        floorSize: 8,
        rollSize: 24,
        standardUnitPrice: 10.0,
        floorUnitPrice: 8.0,
        rollUnitPrice: 7.0,
        promoUnitPrice: 0.0,
    );

    expect($unitPrice)->toBe(7.0);
});

/**
 * Business Rules:
 * BR-005
 */
it('keeps the floor unit price below the roll threshold', function () {
    $selector = new ProductVolumePriceSelector();

    $unitPrice = $selector->selectUnitPrice(
        quantity: 23,
        traySize: 4,
        floorSize: 8,
        rollSize: 24,
        standardUnitPrice: 10.0,
        floorUnitPrice: 8.0,
        rollUnitPrice: 7.0,
        promoUnitPrice: 0.0,
    );

    expect($unitPrice)->toBe(8.0);
});

/**
 * Business Rules:
 * BR-006
 */
it('applies the promo unit price instead of the roll unit price when promo is active', function () {
    $selector = new ProductVolumePriceSelector();

    $unitPrice = $selector->selectUnitPrice(
        quantity: 24,
        traySize: 4,
        floorSize: 8,
        rollSize: 24,
        standardUnitPrice: 10.0,
        floorUnitPrice: 8.0,
        rollUnitPrice: 7.0,
        promoUnitPrice: 6.0,
    );

    expect($unitPrice)->toBe(6.0);
});