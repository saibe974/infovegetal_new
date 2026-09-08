<?php

namespace App\Models;

use App\Casts\DaysMask;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Carrier extends Model
{
    use HasFactory;
    use Traits\HasSortable;

    protected $fillable = [
        'name',
        'days',
        'minimum_delay_hours',
        'order_cutoff_time',
        'taxgo',
    ];

    protected $casts = [
        'days' => DaysMask::class,
        'minimum_delay_hours' => 'integer',
        'taxgo' => 'decimal:2',
    ];

    protected $sortable = [
        'id',
        'name',
        'days',
        'minimum_delay_hours',
        'order_cutoff_time',
        'taxgo',
        'zones_count',
        'created_at',
        'updated_at',
    ];

    public function zones()
    {
        return $this->hasMany(CarrierZone::class);
    }

    public function dbProducts()
    {
        return $this->belongsToMany(DbProducts::class, 'carrier_db_product', 'carrier_id', 'db_product_id')
            ->withPivot('supplement_per_roll');
    }

    public function supplementsByDb(): array
    {
        return $this->dbProducts->mapWithKeys(fn ($db) => [(int) $db->id => (float) $db->pivot->supplement_per_roll])->all();
    }
}
