<?php

namespace App\Domain\Promotions\Enums;

enum PromotionVisibility: string
{
    case Public = 'public';
    case Authenticated = 'authenticated';
    case Targeted = 'targeted';
    case Unlisted = 'unlisted';
}
