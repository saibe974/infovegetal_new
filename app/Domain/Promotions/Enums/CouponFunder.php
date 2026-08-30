<?php

namespace App\Domain\Promotions\Enums;

enum CouponFunder: string
{
    case Seller = 'seller';
    case BillingUser = 'billing_user';
}
