<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\PriceSourceType;
use App\Domain\Sales\ValueObjects\Percentage;
use App\Domain\Sales\ValueObjects\Money;

final readonly class ProductPriceReference
{
    public function __construct(
        public int $productId,
        public int $dbProductId,
        public PriceSourceType $priceSource,
        public Money $baseUnitPriceHt,
        public ?Percentage $weightingPercent = null,
    ) {
    }
}
