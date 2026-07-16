<?php

declare(strict_types=1);

use App\Domain\Sales\Services\ProductPriceFallbackResolver;

/**
 * Business Rules:
 * BR-007
 * BR-008
 */
it('keeps available source prices unchanged', function () {
    $resolver = new ProductPriceFallbackResolver();

    expect($resolver->resolve(12.34, 18.0, 24.0, 0.0))
        ->toBe([12.34, 18.0, 24.0, 0.0]);
});

/**
 * Business Rules:
 * BR-007
 */
it('forces a minimal positive fallback when all source prices are absent', function () {
    $resolver = new ProductPriceFallbackResolver();

    expect($resolver->resolve(0.0, 0.0, 0.0, 0.0))
        ->toBe([0.01, 0.01, 0.01, 0.0]);
});

/**
 * Business Rules:
 * BR-007
 */
it('forces a minimal positive fallback when all source prices are negative', function () {
    $resolver = new ProductPriceFallbackResolver();

    expect($resolver->resolve(-5.0, -3.0, -2.0, 0.0))
        ->toBe([0.01, 0.01, 0.01, 0.0]);
});

/**
 * Business Rules:
 * BR-008
 */
it('falls back from roll to floor then standard for roll resolution', function () {
    $resolver = new ProductPriceFallbackResolver();

    expect($resolver->resolve(10.0, 8.0, 0.0, 0.0, false, true))
        ->toBe([10.0, 8.0, 8.0, 0.0])
        ->and($resolver->resolve(10.0, 0.0, 0.0, 0.0, false, true))
        ->toBe([10.0, 10.0, 10.0, 0.0]);
});

/**
 * Business Rules:
 * BR-008
 */
it('keeps zero roll unresolved when no fallback source exists and synthetic minimum is disabled', function () {
    $resolver = new ProductPriceFallbackResolver();

    expect($resolver->resolve(0.0, 0.0, 0.0, 0.0, false))
        ->toBe([0.0, 0.0, 0.0, 0.0]);
});