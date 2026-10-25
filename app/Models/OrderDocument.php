<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderDocument extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected $casts = ['snapshot' => 'array', 'issued_at' => 'datetime'];
}
