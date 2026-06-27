<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DbProducts extends Model
{
    use Traits\HasSortable;

    protected $fillable = [
        'name',
        'description',
        'defaults',
        'champs',
        'categories',
        'traitement',
        'header_row_index',
        'source_delimiter',
        'mergins',
        'country',
        'mod_liv',
        'mini',
    ];

    protected $sortable = [
        'id',
        'name',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'defaults' => 'array',
        'champs' => 'array',
        'categories' => 'array',
        'mergins' => 'array',
        'header_row_index' => 'integer',
        'mini' => 'integer',
    ];

    /**
     * Inverse many-to-many relation to users via pivot `db_product_user`.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(\App\Models\User::class, 'db_product_user', 'db_product_id', 'user_id')
            ->withTimestamps()
            ->withPivot(['can_access', 'can_buy', 'can_invoice', 'can_sell', 'can_manage', 'attributes']);
    }

    /**
     * Billing users attached to this DB product.
     */
    public function billingUsers(): BelongsToMany
    {
        return $this->belongsToMany(\App\Models\User::class, 'db_product_billing_user', 'db_product_id', 'billing_user_id')
            ->withTimestamps()
            ->withPivot(['defaults', 'active']);
    }

    /**
     * Raw billing rules rows for this DB product.
     */
    public function billingRules(): HasMany
    {
        return $this->hasMany(DbProductBillingUser::class, 'db_product_id');
    }

    public function clientSalesConditions(): HasMany
    {
        return $this->hasMany(ClientSalesCondition::class, 'db_product_id');
    }

    public function orderHeaders(): HasMany
    {
        return $this->hasMany(OrderHeader::class, 'db_product_id');
    }

    public function orderLines(): HasMany
    {
        return $this->hasMany(OrderLine::class, 'db_product_id');
    }
}
