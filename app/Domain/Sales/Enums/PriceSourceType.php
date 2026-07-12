<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum PriceSourceType: string
{
    case Standard = 'standard';
    case Floor = 'floor';
    case Roll = 'roll';
    case Promo = 'promo';
    case LegacyConditionReference = 'legacy_condition_reference';
}
