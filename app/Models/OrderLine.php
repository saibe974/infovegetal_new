<?php

namespace App\Models;

use App\Models\OrderHeader;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderLine extends Model
{
    protected $fillable = [
        'order_header_id',
        'product_id',
        'db_product_id',
        'product_name',
        'product_ref',
        'product_ean',
        'producer_id',
        'quantity',
        'cond',
        'floor',
        'roll',
        'purchase_price',
        'selling_price',
        'transport_price',
        'margin_amount',
        'margin_percent',
        'line_total_ht',
        'line_total_tva',
        'line_total_ttc',
        'tva_rate',
        'product_snapshot',
        'meta',
    ];

    protected $casts = [
        'purchase_price' => 'decimal:4',
        'selling_price' => 'decimal:4',
        'transport_price' => 'decimal:4',
        'margin_amount' => 'decimal:4',
        'margin_percent' => 'decimal:4',
        'line_total_ht' => 'decimal:2',
        'line_total_tva' => 'decimal:2',
        'line_total_ttc' => 'decimal:2',
        'tva_rate' => 'decimal:2',
        'product_snapshot' => 'array',
        'meta' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(OrderHeader::class, 'order_header_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function dbProduct(): BelongsTo
    {
        return $this->belongsTo(DbProducts::class, 'db_product_id');
    }

    public function scopeCurrentMonth(Builder $query): Builder
    {
        return $query->whereHas('order', fn (Builder $q) => $q->currentMonth());
    }

    public function scopeCurrentYear(Builder $query): Builder
    {
        return $query->whereHas('order', fn (Builder $q) => $q->currentYear());
    }

    public function scopeCompleted(Builder $query): Builder
    {
        return $query->whereHas('order', fn (Builder $q) => $q->completed());
    }

    public function scopeCancelled(Builder $query): Builder
    {
        return $query->whereHas('order', fn (Builder $q) => $q->cancelled());
    }
}
