<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderHeader extends Model
{
    protected $fillable = [
        'cart_id',
        'client_user_id',
        'billing_user_id',
        'seller_user_id',
        'db_product_id',
        'order_number',
        'order_date',
        'status',
        'currency',
        'items_total_ht',
        'shipping_total_ht',
        'total_ht',
        'total_tva',
        'total_ttc',
        'conditions_snapshot',
        'meta',
    ];

    protected $casts = [
        'order_date' => 'datetime',
        'items_total_ht' => 'decimal:2',
        'shipping_total_ht' => 'decimal:2',
        'total_ht' => 'decimal:2',
        'total_tva' => 'decimal:2',
        'total_ttc' => 'decimal:2',
        'conditions_snapshot' => 'array',
        'meta' => 'array',
    ];

    public function cart(): BelongsTo
    {
        return $this->belongsTo(Cart::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_user_id');
    }

    public function billingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'billing_user_id');
    }

    public function sellerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_user_id');
    }

    public function dbProduct(): BelongsTo
    {
        return $this->belongsTo(DbProducts::class, 'db_product_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(OrderLine::class, 'order_header_id');
    }

    public function scopeCurrentMonth(Builder $query): Builder
    {
        return $query->whereBetween('order_date', [now()->startOfMonth(), now()->endOfMonth()]);
    }

    public function scopeCurrentYear(Builder $query): Builder
    {
        return $query->whereBetween('order_date', [now()->startOfYear(), now()->endOfYear()]);
    }

    public function scopeCompleted(Builder $query): Builder
    {
        return $query->where('status', 'completed');
    }

    public function scopeCancelled(Builder $query): Builder
    {
        return $query->where('status', 'cancelled');
    }
}
