<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class CarrierZone extends Model
{
    use HasFactory;

    protected $fillable = [
        'carrier_id',
        'name',
        'tariffs',
    ];

    protected $casts = [
        'tariffs' => 'array',
    ];

    public function carrier()
    {
        return $this->belongsTo(Carrier::class);
    }
}
