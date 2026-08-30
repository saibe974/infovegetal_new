<?php

namespace App\Domain\Promotions\Enums;

enum CouponScope: string
{
    case Cart = 'cart';
    case PromotionProducts = 'promotion_products';
}
