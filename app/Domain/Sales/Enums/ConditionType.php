<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum ConditionType: string
{
    case MarginPercent = 'margin_percent';
    case DiscountPercent = 'discount_percent';
    case DiscountFixed = 'discount_fixed';
}
