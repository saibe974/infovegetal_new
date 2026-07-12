<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum SalesCalculationErrorCode: string
{
    case CurrencyMismatch = 'currency_mismatch';
    case InvalidPercentage = 'invalid_percentage';
    case InvalidQuantity = 'invalid_quantity';
    case MissingBasePrice = 'missing_base_price';
    case MissingVatConfiguration = 'missing_vat_configuration';
    case DiscountExceedsActorMargin = 'discount_exceeds_actor_margin';
    case ArithmeticOverflow = 'arithmetic_overflow';
}
