<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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
        'mergins',
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
    ];

    /**
     * Inverse many-to-many relation to users via pivot `db_products_users`.
     */
    public function users()
    {
        return $this->belongsToMany(\App\Models\User::class, 'db_products_users', 'db_product_id', 'user_id')
            ->withTimestamps()->withPivot('attributes');
    }

    
}
