<?php

namespace App\Models;

use App\Models\CategoryProducts;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

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

    public function registerMediaConversions(?Media $media = null): void
    {
        // Thumb: utilisee par les listes et elFinder.
        $this->addMediaConversion('thumb')
            ->fit(Fit::Contain, 200, 200)
            ->quality(78)
            ->performOnCollections('images')
            ->nonQueued();

        // Small: usage cards/front/pdf leger.
        $this->addMediaConversion('small')
            ->fit(Fit::Contain, 600, 600)
            ->quality(82)
            ->performOnCollections('images')
            ->nonQueued();

        // Medium: usage detail/site et PDF meilleure qualite.
        $this->addMediaConversion('medium')
            ->fit(Fit::Contain, 1200, 1200)
            ->quality(85)
            ->performOnCollections('images')
            ->nonQueued();
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

    public function getPriceRollAttribute($value): ?string
    {
        $roll = is_numeric($value) ? (float) $value : 0.0;
        if ($roll > 0) {
            return number_format($roll, 2, '.', '');
        }

        $floor = $this->attributes['price_floor'] ?? null;
        if (is_numeric($floor) && (float) $floor > 0) {
            return number_format((float) $floor, 2, '.', '');
        }

        $price = $this->attributes['price'] ?? null;
        if (is_numeric($price) && (float) $price > 0) {
            return number_format((float) $price, 2, '.', '');
        }

        return $value;
    }
}
