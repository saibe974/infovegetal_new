<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CategoryProducts extends Model
{
    use Traits\HasSortable;

    protected $fillable = [
        'name',
    ];
}
