<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DbProducts extends Model
{
    protected $fillable = [
        'name',
        'description',
        'defaults',
        'champs',
        'categories',
        'traitement',
        'mergins',
    ];

    protected $casts = [
        'defaults' => 'array',
        'champs' => 'array',
        'categories' => 'array',
        'mergins' => 'array',
    ];

    
}
