<?php

namespace App\Models;

use App\Casts\DaysMask;
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
        'minimum_delay_hours',
        'order_cutoff_time',
        'minimum',
        'taxgo',
    ];

    protected $casts = [
        'days' => DaysMask::class,
        'minimum_delay_hours' => 'integer',
        'minimum' => 'integer',
        'taxgo' => 'decimal:2',
    ];

    protected $sortable = [
        'id',
        'name',
        'country',
        'days',
        'minimum_delay_hours',
        'order_cutoff_time',
        'minimum',
        'taxgo',
        'zones_count',
        'created_at',
        'updated_at',
    ];

    public function zones()
    {
        return $this->hasMany(CarrierZone::class);
    }
}
