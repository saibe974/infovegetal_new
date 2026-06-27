<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillingUserSellerUser extends Model
{
    protected $table = 'billing_user_seller_user';

    protected $fillable = [
        'billing_user_id',
        'seller_user_id',
        'active',
        'conditions_override',
    ];

    protected $casts = [
        'active' => 'boolean',
        'conditions_override' => 'array',
    ];

    public function billingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'billing_user_id');
    }

    public function sellerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_user_id');
    }
}
