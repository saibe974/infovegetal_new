<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DbProductBillingUser extends Model
{
    protected $table = 'db_product_billing_user';

    protected $fillable = [
        'db_product_id',
        'billing_user_id',
        'defaults',
        'active',
    ];

    protected $casts = [
        'defaults' => 'array',
        'active' => 'boolean',
    ];

    public function dbProduct(): BelongsTo
    {
        return $this->belongsTo(DbProducts::class, 'db_product_id');
    }

    public function billingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'billing_user_id');
    }
}
