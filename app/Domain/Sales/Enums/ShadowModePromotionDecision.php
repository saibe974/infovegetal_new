<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum ShadowModePromotionDecision: string
{
    case Promote = 'promote';
    case Hold = 'hold';
    case Block = 'block';
}
