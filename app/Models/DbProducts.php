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

    
}
