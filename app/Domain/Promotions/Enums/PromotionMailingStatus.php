<?php

namespace App\Domain\Promotions\Enums;

enum PromotionMailingStatus: string
{
    case Draft = 'draft';
    case Ready = 'ready';
    case Sending = 'sending';
    case Sent = 'sent';
    case Cancelled = 'cancelled';
}
