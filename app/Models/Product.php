<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use Traits\HasSortable;

    protected $fillable = [
        'sku',
        'name',
        'description',
        'img_link',
        'price',
        'active',
        'attributes',
    ];

    protected $sortable = [
        'id',
        'sku',
        'name',
        'price',
        'active',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'attributes' => 'array',
        'active' => 'boolean',
        'price' => 'decimal:2',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    /**
     * Backwards-compatible accessor expected by API: price_ex_vat
     */
    public function getPriceExVatAttribute()
    {
        return isset($this->attributes['price']) ? $this->attributes['price'] : null;
    }
}
