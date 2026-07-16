<?php

declare(strict_types=1);

use App\Domain\Sales\Services\ProductPriceSourceResolver;
use App\Models\Product;

function makeSourceResolverProduct(?float $price, ?float $priceFloor = null, ?float $priceRoll = null, ?float $pricePromo = null): Product
{
    $product = new Product();
    $product->price = $price;
    $product->price_floor = $priceFloor;
    $product->price_roll = $priceRoll;
    $product->price_promo = $pricePromo;

    return $product;
}

/**
 * Business Rules:
 * BR-001
 */
it('keeps the standard price set unchanged when the base unit price is already valid', function () {
    $resolver = new ProductPriceSourceResolver();

    expect($resolver->resolveStandardPrices(makeSourceResolverProduct(12.34, 18.0, 24.0, 0.0)))
        ->toBe([12.34, 18.0, 24.0, 0.0]);
});

/**
 * Business Rules:
 * BR-001
 */
it('returns raw source prices when the standard unit price is absent', function () {
    $resolver = new ProductPriceSourceResolver();

    expect($resolver->resolveStandardPrices(makeSourceResolverProduct(0.0, 18.0, 24.0, 0.0)))
        ->toBe([0.0, 18.0, 24.0, 0.0]);
});

/**
 * Business Rules:
 * BR-009
 */
it('resolves the special source as the standard floor and roll prices', function () {
    $product = makeSourceResolverProduct(10.0, 8.0, 7.0, 0.0);
    $product->price_special_1 = 17.5;

    $resolver = new ProductPriceSourceResolver();

    expect($resolver->resolveSpecialPriceSet($product, 'price_special_1'))
        ->toBe([17.5, 17.5, 17.5, 0.0]);
});

/**
 * Business Rules:
 * BR-009
 */
it('falls back to the current standard source when the special source is absent', function () {
    $resolver = new ProductPriceSourceResolver();

    expect($resolver->resolveSpecialPriceSet(makeSourceResolverProduct(10.0, 8.0, 7.0, 0.0), 'price_special_1'))
        ->toBe([10.0, 10.0, 10.0, 0.0]);
});

/**
 * Business Rules:
 * BR-009
 */
it('normalizes legacy and explicit price modes', function () {
    $resolver = new ProductPriceSourceResolver();

    expect($resolver->normalizePriceMode('price_special_1'))->toBe('price_special_1')
        ->and($resolver->normalizePriceMode('price_depart'))->toBe(0)
        ->and($resolver->normalizePriceMode('rendu'))->toBe(1)
        ->and($resolver->normalizePriceMode(-1))->toBe(-1);
});