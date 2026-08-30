<?php

namespace App\Domain\Promotions\Enums;

enum PromotionMailingRecipientStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Sent = 'sent';
    case Skipped = 'skipped';
    case Failed = 'failed';
}
