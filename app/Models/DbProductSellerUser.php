<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DbProductSellerUser extends Model
{
    protected $table = 'db_product_seller_user';

    protected $fillable = [
        'db_product_id',
        'billing_user_id',
        'seller_user_id',
        'conditions',
        'use_billing_profile',
        'billing_profile_id',
        'seller_defaults',
        'can_manage',
        'active',
    ];

    protected $casts = [
        'conditions' => 'array',
        'seller_defaults' => 'array',
        'use_billing_profile' => 'boolean',
        'can_manage' => 'boolean',
        'active' => 'boolean',
    ];

    public function dbProduct(): BelongsTo
    {
        return $this->belongsTo(DbProducts::class, 'db_product_id');
    }

    public function sellerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_user_id');
    }

    public function billingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'billing_user_id');
    }
}
