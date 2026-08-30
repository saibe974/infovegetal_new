<?php

namespace App\Domain\Promotions\Enums;

enum PromotionAudienceMode: string
{
    case AllAccessible = 'all_accessible';
    case Selected = 'selected';
}
