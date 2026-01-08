<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Producer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'description',
    ];

    /**
     * Les produits de ce producteur
     */
    public function products()
    {
        return $this->hasMany(Product::class, 'producer_id');
    }
}
