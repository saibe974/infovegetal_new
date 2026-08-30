<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromotionCouponRedemption extends Model
{
    protected $fillable = [
        'promotion_coupon_id',
        'promotion_id',
        'cart_id',
        'user_id',
        'discount_amount_ht',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'discount_amount_ht' => 'decimal:2',
            'used_at' => 'immutable_datetime',
        ];
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(PromotionCoupon::class, 'promotion_coupon_id');
    }

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    public function cart(): BelongsTo
    {
        return $this->belongsTo(Cart::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
