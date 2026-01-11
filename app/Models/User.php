<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Spatie\Permission\Traits\HasRoles;
use Kalnoy\Nestedset\NodeTrait;
use Lab404\Impersonate\Models\Impersonate;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable, HasRoles, NodeTrait, Impersonate;

    public function cart()
    {
        return $this->hasOne(Cart::class);
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        '_lft',
        '_rgt',
        'parent_id',
        'old_id',
        'old_parent_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factory_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Get the files for the user.
     */
    public function files(): HasMany
    {
        return $this->hasMany(File::class);
    }

    /**
     * Many-to-many relation to DbProducts via pivot `db_products_users`.
     */
    public function dbProducts(): BelongsToMany
    {
        return $this->belongsToMany(
            \App\Models\DbProducts::class,
            'db_products_users',
            'user_id',
            'db_product_id',
        )->withTimestamps()->withPivot('attributes');
    }

    /**
     * Détermine si l'utilisateur peut impersonner d'autres utilisateurs.
     * Seuls les admins peuvent impersonner.
     */
    public function canImpersonate(): bool
    {
        return $this->hasRole('admin');
    }

    /**
     * Détermine si l'utilisateur peut être impersonné.
     * Les admins ne peuvent pas être impersonés par sécurité.
     */
    public function canBeImpersonated(): bool
    {
        return !$this->hasRole('admin');
    }
}
