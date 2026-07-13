<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ProductVatResolutionInput;
use App\Domain\Sales\Enums\ProductVatSource;
use App\Domain\Sales\Services\ProductVatResolver;
use App\Domain\Sales\ValueObjects\Percentage;

it('uses product vat rate when available', function (): void {
    $resolver = new ProductVatResolver();

    $result = $resolver->resolve(new ProductVatResolutionInput(
        productId: 10,
        categoryId: 5,
        productVatRate: Percentage::fromString('10'),
        categoryVatRate: Percentage::fromString('20'),
    ));

    expect($result->source)->toBe(ProductVatSource::Product)
        ->and($result->vatRate->basisPoints)->toBe(1000)
        ->and($result->categoryId)->toBe(5);
});

/**
 * Business Rules:
 * BR-026
 */
it('allows a zero product vat rate when the product rate is explicitly provided', function (): void {
    $resolver = new ProductVatResolver();

    $result = $resolver->resolve(new ProductVatResolutionInput(
        productId: 10,
        categoryId: 5,
        productVatRate: Percentage::fromString('0'),
        categoryVatRate: Percentage::fromString('5.5'),
    ));

    expect($result->source)->toBe(ProductVatSource::Product)
        ->and($result->vatRate->basisPoints)->toBe(0)
        ->and($result->categoryId)->toBe(5);
});

it('falls back to category vat rate when product vat is missing', function (): void {
    $resolver = new ProductVatResolver();

    $result = $resolver->resolve(new ProductVatResolutionInput(
        productId: 10,
        categoryId: 5,
        productVatRate: null,
        categoryVatRate: Percentage::fromString('5.5'),
    ));

    expect($result->source)->toBe(ProductVatSource::Category)
        ->and($result->vatRate->basisPoints)->toBe(550)
        ->and($result->categoryId)->toBe(5);
});

/**
 * Business Rules:
 * BR-027
 */
it('allows a zero category vat rate when the category rate is explicitly provided', function (): void {
    $resolver = new ProductVatResolver();

    $result = $resolver->resolve(new ProductVatResolutionInput(
        productId: 10,
        categoryId: 5,
        productVatRate: null,
        categoryVatRate: Percentage::fromString('0'),
    ));

    expect($result->source)->toBe(ProductVatSource::Category)
        ->and($result->vatRate->basisPoints)->toBe(0)
        ->and($result->categoryId)->toBe(5);
});

it('throws when category id is missing', function (): void {
    $resolver = new ProductVatResolver();

    $resolver->resolve(new ProductVatResolutionInput(
        productId: 10,
        categoryId: null,
        productVatRate: Percentage::fromString('20'),
        categoryVatRate: null,
    ));
})->throws(DomainException::class, 'Category id is required');

it('throws when no vat rate exists on product nor category', function (): void {
    $resolver = new ProductVatResolver();

    $resolver->resolve(new ProductVatResolutionInput(
        productId: 10,
        categoryId: 5,
        productVatRate: null,
        categoryVatRate: null,
    ));
})->throws(DomainException::class, 'Unable to resolve VAT rate');
