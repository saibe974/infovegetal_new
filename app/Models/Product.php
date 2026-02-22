<?php

namespace App\Models;

use App\Models\CategoryProducts;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Product extends Model implements HasMedia
{
    use HasFactory;
    use Traits\HasSortable;
    use InteractsWithMedia;

    protected $fillable = [
        'sku',
        'name',
        'description',
        'img_link',
        'price',
        'active',
        'attributes',
        'category_products_id',
        'db_products_id',
        'ref',
        'ean13',
        'pot',
        'height',
        'price_floor',
        'price_roll',
        'price_promo',
        'producer_id',
        'tva_id',
        'cond',
        'floor',
        'roll',
    ];

    protected $sortable = [
        'id',
        'sku',
        'name',
        'price',
        'active',
        'created_at',
        'updated_at',
        'category_products_id',
        'db_products_id',
        'ref',
        'ean13',
        'pot',
        'height',
        'price_floor',
        'price_roll',
        'price_promo',
        'producer_id',
        'cond',
        'floor',
        'roll',
    ];

    protected $casts = [
        'attributes' => 'array',
        'active' => 'boolean',
        'price' => 'decimal:2',
        'price_floor' => 'decimal:2',
        'price_roll' => 'decimal:2',
        'price_promo' => 'decimal:2',
        'pot' => 'decimal:2',
        'cond' => 'integer',
        'floor' => 'integer',
        'roll' => 'integer',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('images')
            ->useDisk(config('media-library.disk_name', 'public'))
            ->singleFile();
    }

    public function getImgLinkAttribute(): ?string
    {
        $mediaUrl = $this->getFirstMediaUrl('images');
        if ($mediaUrl !== '') {
            return $mediaUrl;
        }

        return $this->attributes['img_link'] ?? null;
    }


    public function category()
    {
        return $this->belongsTo(CategoryProducts::class, 'category_products_id');
    }

    public function producer()
    {
        return $this->belongsTo(Producer::class, 'producer_id');
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class)->withTimestamps();
    }

    // Relation vers la DB associée
    public function dbProduct()
    {
        return $this->belongsTo(\App\Models\DbProducts::class, 'db_products_id');
    }

    /**
     * Backwards-compatible accessor expected by API: price_ex_vat
     */
    public function getPriceExVatAttribute()
    {
        return isset($this->attributes['price']) ? $this->attributes['price'] : null;
    }
}
