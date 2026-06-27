<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientSalesCondition extends Model
{
    protected $fillable = [
        'client_user_id',
        'db_product_id',
        'billing_user_id',
        'seller_user_id',
        'conditions_override',
        'active',
    ];

    protected $casts = [
        'conditions_override' => 'array',
        'active' => 'boolean',
    ];

    public function clientUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_user_id');
    }

    public function dbProduct(): BelongsTo
    {
        return $this->belongsTo(DbProducts::class, 'db_product_id');
    }

    public function billingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'billing_user_id');
    }

    public function sellerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_user_id');
    }
}
