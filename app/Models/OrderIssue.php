<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderIssue extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['reviewed_at' => 'datetime'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
