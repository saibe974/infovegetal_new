<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\ValueObjects\Percentage;

final readonly class ProductVatResolutionInput
{
    public function __construct(
        public int $productId,
        public ?int $categoryId,
        public ?Percentage $productVatRate,
        public ?Percentage $categoryVatRate,
    ) {
    }
}
