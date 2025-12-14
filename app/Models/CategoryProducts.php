<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Kalnoy\Nestedset\NodeTrait;

class CategoryProducts extends Model
{
    use Traits\HasSortable;
    use NodeTrait;

    protected $fillable = [
        'name',
    ];
}
