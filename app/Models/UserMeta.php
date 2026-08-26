<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserMeta extends Model
{
    use HasFactory;

    public const APPEARANCE_PREFERENCES_KEY = 'appearance_preferences';

    public const SYSTEM_KEYS = ['logo', self::APPEARANCE_PREFERENCES_KEY];

    protected $table = 'users_meta';

    protected $fillable = [
        'user_id',
        'key',
        'title',
        'value',
        'type',
        'sort_order',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
