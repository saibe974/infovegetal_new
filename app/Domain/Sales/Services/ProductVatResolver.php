<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\DTO\ProductVatResolutionInput;
use App\Domain\Sales\DTO\ProductVatResolutionResult;
use App\Domain\Sales\Enums\ProductVatSource;
use DomainException;

final class ProductVatResolver
{
    public function resolve(ProductVatResolutionInput $input): ProductVatResolutionResult
    {
        if ($input->categoryId === null) {
            throw new DomainException('Category id is required to resolve product VAT.');
        }

        if ($input->productVatRate !== null) {
            return new ProductVatResolutionResult(
                productId: $input->productId,
                categoryId: $input->categoryId,
                vatRate: $input->productVatRate,
                source: ProductVatSource::Product,
            );
        }

        if ($input->categoryVatRate !== null) {
            return new ProductVatResolutionResult(
                productId: $input->productId,
                categoryId: $input->categoryId,
                vatRate: $input->categoryVatRate,
                source: ProductVatSource::Category,
            );
        }

        throw new DomainException('Unable to resolve VAT rate: missing product and category VAT rates.');
    }
}
