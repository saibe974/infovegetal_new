<?php

namespace App\Domain\Promotions\Enums;

enum CouponDiscountType: string
{
    case Percent = 'percent';
    case Fixed = 'fixed';
}
