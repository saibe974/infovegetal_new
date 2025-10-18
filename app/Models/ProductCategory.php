<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductCategory extends Model
{
    use Traits\HasSortable;

    protected $fillable = [
        'name',
    ];
}
