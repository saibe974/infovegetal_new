<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cart extends Model
{
    protected $fillable = [
        'user_id',
        'status',
        'items_total',
        'shipping_total',
        'transport_selection',
        'discounts',
    ];

    protected $casts = [
        'items_total' => 'decimal:2',
        'shipping_total' => 'decimal:2',
        'transport_selection' => 'array',
        'discounts' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function products()
    {
        return $this->belongsToMany(Product::class, 'cart_product')
            ->withPivot('quantity')
            ->withTimestamps();
    }

    public function orderHeaders(): HasMany
    {
        return $this->hasMany(OrderHeader::class, 'cart_id');
    }
}
