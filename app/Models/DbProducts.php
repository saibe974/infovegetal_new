<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DbProducts extends Model
{
    protected $fillable = [
        'name',
        'description',
        'defaults',
        'mergins',
    ];

    protected $casts = [
        'defaults' => 'array',
        'mergins' => 'array',
    ];
}
