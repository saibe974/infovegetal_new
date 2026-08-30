<?php

namespace App\Models;

use App\Domain\Promotions\Enums\PromotionMailingStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PromotionMailing extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'created_by_id',
        'name',
        'subject',
        'preheader',
        'heading',
        'body',
        'cta_label',
        'cta_url',
        'status',
        'scheduled_at',
        'snapshot_at',
        'started_at',
        'completed_at',
        'recipient_count',
        'sent_count',
        'skipped_count',
        'failed_count',
    ];

    protected function casts(): array
    {
        return [
            'status' => PromotionMailingStatus::class,
            'scheduled_at' => 'immutable_datetime',
            'snapshot_at' => 'immutable_datetime',
            'started_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
            'recipient_count' => 'integer',
            'sent_count' => 'integer',
            'skipped_count' => 'integer',
            'failed_count' => 'integer',
        ];
    }

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(PromotionMailingRecipient::class);
    }
}
