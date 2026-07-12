<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\RoundingRule;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

final readonly class ProductComponentBreakdown
{
    public function __construct(
        public Money $dbLineBaseHt,
        public Money $billingMarginLineHt,
        public Money $sellerMarginLineHt,
        public Money $discountPercentLineHt,
        public Money $discountFixedLineHt,
        public Money $finalLineHt,
        public Percentage $productVatRate,
        public Money $productVatLineAmount,
        public Money $finalLineTtc,
        public RoundingRule $roundingRule,
    ) {
    }
}
