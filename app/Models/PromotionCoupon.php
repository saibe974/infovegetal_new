<?php

namespace App\Models;

use App\Domain\Promotions\Enums\CouponDiscountType;
use App\Domain\Promotions\Enums\CouponFunder;
use App\Domain\Promotions\Enums\CouponScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PromotionCoupon extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code',
        'discount_type',
        'discount_value',
        'scope',
        'funded_by',
        'minimum_order_ht',
        'maximum_discount_ht',
        'usage_limit',
        'usage_limit_per_customer',
        'starts_at',
        'ends_at',
        'stackable_with_promo_price',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'discount_type' => CouponDiscountType::class,
            'scope' => CouponScope::class,
            'funded_by' => CouponFunder::class,
            'discount_value' => 'decimal:2',
            'minimum_order_ht' => 'decimal:2',
            'maximum_discount_ht' => 'decimal:2',
            'usage_limit' => 'integer',
            'usage_limit_per_customer' => 'integer',
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
            'stackable_with_promo_price' => 'boolean',
            'active' => 'boolean',
        ];
    }

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(PromotionCouponRedemption::class);
    }

    public function getEffectiveStartsAtAttribute(): mixed
    {
        return $this->starts_at ?? $this->promotion?->starts_at;
    }

    public function getEffectiveEndsAtAttribute(): mixed
    {
        return $this->ends_at ?? $this->promotion?->ends_at;
    }
}
