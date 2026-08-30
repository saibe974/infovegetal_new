<?php

namespace App\Domain\Promotions\Enums;

enum PromotionStatus: string
{
    case Draft = 'draft';
    case Ready = 'ready';
    case Scheduled = 'scheduled';
    case Active = 'active';
    case Suspended = 'suspended';
    case Ended = 'ended';
    case Cancelled = 'cancelled';
}
