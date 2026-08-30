<?php

namespace App\Models;

use App\Domain\Promotions\Enums\PromotionMailingRecipientStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromotionMailingRecipient extends Model
{
    protected $fillable = [
        'user_id',
        'email_snapshot',
        'name_snapshot',
        'status',
        'skip_reason',
        'error',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => PromotionMailingRecipientStatus::class,
            'sent_at' => 'immutable_datetime',
        ];
    }

    public function mailing(): BelongsTo
    {
        return $this->belongsTo(PromotionMailing::class, 'promotion_mailing_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
