<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\ProductCategory;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Product extends Model
{
    use HasFactory;
    use Traits\HasSortable;

    protected $fillable = [
        'sku',
        'name',
        'description',
        'img_link',
        'price',
        'active',
        'attributes',
        'product_category_id',
    ];

    protected $sortable = [
        'id',
        'sku',
        'name',
        'price',
        'active',
        'created_at',
        'updated_at',
        'product_category_id',
    ];

    protected $casts = [
        'attributes' => 'array',
        'active' => 'boolean',
        'price' => 'decimal:2',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    public function category()
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class)->withTimestamps();
    }

    /**
     * Backwards-compatible accessor expected by API: price_ex_vat
     */
    public function getPriceExVatAttribute()
    {
        return isset($this->attributes['price']) ? $this->attributes['price'] : null;
    }
}
