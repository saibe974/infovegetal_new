<?php

namespace App\Models;

use App\Domain\Promotions\Enums\PromotionAudienceMode;
use App\Domain\Promotions\Enums\PromotionStatus;
use App\Domain\Promotions\Enums\PromotionVisibility;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Promotion extends Model
{
    use HasFactory, SoftDeletes;

    public const MAX_SELECTED_PRODUCTS = 100;

    protected $fillable = [
        'title',
        'slug',
        'description',
        'status',
        'visibility',
        'audience_mode',
        'audience_updated_at',
        'created_by_id',
        'responsible_user_id',
        'starts_at',
        'ends_at',
        'published_at',
        'suspended_at',
        'presentation_title',
        'presentation_body',
        'terms',
        'show_coupons',
    ];

    protected function casts(): array
    {
        return [
            'status' => PromotionStatus::class,
            'visibility' => PromotionVisibility::class,
            'audience_mode' => PromotionAudienceMode::class,
            'audience_updated_at' => 'immutable_datetime',
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
            'published_at' => 'immutable_datetime',
            'suspended_at' => 'immutable_datetime',
            'show_coupons' => 'boolean',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function effectiveStatusAt(?CarbonInterface $moment = null): PromotionStatus
    {
        $moment ??= now();
        if (! in_array($this->status, [PromotionStatus::Active, PromotionStatus::Scheduled], true)) {
            return $this->status;
        }
        if ($this->ends_at?->lt($moment)) {
            return PromotionStatus::Ended;
        }
        if ($this->starts_at?->gt($moment)) {
            return PromotionStatus::Scheduled;
        }

        return PromotionStatus::Active;
    }

    public function isLiveAt(?CarbonInterface $moment = null): bool
    {
        return $this->effectiveStatusAt($moment) === PromotionStatus::Active;
    }

    public function scopeEffectiveStatus(Builder $query, PromotionStatus $status): Builder
    {
        $moment = now();
        if ($status === PromotionStatus::Ended) {
            return $query->where(fn (Builder $q) => $q->where('status', $status)
                ->orWhere(fn (Builder $q) => $q->whereIn('status', ['active', 'scheduled'])->where('ends_at', '<', $moment)));
        }
        if (in_array($status, [PromotionStatus::Active, PromotionStatus::Scheduled], true)) {
            $query->whereIn('status', ['active', 'scheduled'])
                ->where(fn (Builder $q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', $moment));

            return $status === PromotionStatus::Scheduled
                ? $query->where('starts_at', '>', $moment)
                : $query->where(fn (Builder $q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $moment));
        }

        return $query->where('status', $status);
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'promotion_product')
            ->withPivot([
                'position',
                'featured',
                'show_before_availability',
                'custom_title',
                'custom_description',
            ])
            ->withTimestamps()
            ->orderByPivot('position');
    }

    public function coupons(): HasMany
    {
        return $this->hasMany(PromotionCoupon::class)->latest();
    }

    public function audienceUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'promotion_user')->withTimestamps();
    }

    public function mailings(): HasMany
    {
        return $this->hasMany(PromotionMailing::class)->latest();
    }

    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        $search = trim((string) $search);

        if ($search === '') {
            return $query;
        }

        return $query->where(function (Builder $searchQuery) use ($search): void {
            $searchQuery
                ->where('title', 'like', '%'.$search.'%')
                ->orWhere('slug', 'like', '%'.$search.'%')
                ->orWhereHas('responsible', fn (Builder $userQuery) => $userQuery
                    ->where('name', 'like', '%'.$search.'%'));
        });
    }
}
