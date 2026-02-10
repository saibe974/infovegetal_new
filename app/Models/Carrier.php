<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Carrier extends Model
{
    use HasFactory;
    use Traits\HasSortable;

    protected $fillable = [
        'name',
        'country',
        'days',
        'minimum',
        'taxgo',
    ];

    protected $casts = [
        'days' => 'integer',
        'minimum' => 'integer',
        'taxgo' => 'decimal:2',
    ];

    protected $sortable = [
        'id',
        'name',
        'country',
        'days',
        'minimum',
        'taxgo',
        'created_at',
        'updated_at',
    ];

    public function zones()
    {
        return $this->hasMany(CarrierZone::class);
    }
}
