<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\ProductVatSource;
use App\Domain\Sales\ValueObjects\Percentage;

final readonly class ProductVatResolutionResult
{
    public function __construct(
        public int $productId,
        public int $categoryId,
        public Percentage $vatRate,
        public ProductVatSource $source,
    ) {
    }
}
