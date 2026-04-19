<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Spatie\Permission\Traits\HasRoles;
use Kalnoy\Nestedset\NodeTrait;
use Lab404\Impersonate\Models\Impersonate;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class User extends Authenticatable implements HasMedia
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable, HasRoles {
        hasRole as protected hasRoleTrait;
        hasAnyRole as protected hasAnyRoleTrait;
    }
    use NodeTrait, Impersonate, InteractsWithMedia;

    public function cart(): HasOne
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
        'alias',
        'ref',
        'phone',
        'address_road',
        'address_zip',
        'address_town',
        'active',
        'mailing',
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
            'active' => 'boolean',
            'mailing' => 'boolean',
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
     * User custom key/value metadata.
     */
    public function usersMeta(): HasMany
    {
        return $this->hasMany(UserMeta::class);
    }

    /**
     * Media collections for user profile assets.
     */
    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('user_logos')->singleFile();
        $this->addMediaCollection('user_photos');
        $this->addMediaCollection('user_meta_files');
    }

    /**
     * Standard image conversions for previews and cards.
     */
    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('thumb')
            ->fit(Fit::Crop, 240, 240)
            ->performOnCollections('user_logos', 'user_photos', 'user_meta_files');

        $this->addMediaConversion('medium')
            ->width(900)
            ->performOnCollections('user_logos', 'user_photos', 'user_meta_files');
    }

    /**
     * Détermine si l'utilisateur peut impersonner d'autres utilisateurs.
     * Seuls les admins peuvent impersonner.
     */
    public function canImpersonate(): bool
    {
        if ($this->hasRoleTrait('admin')) {
            return true;
        }

        $impersonator = $this->resolveImpersonator();

        return $impersonator ? $impersonator->hasRoleTrait('admin') : false;
    }

    /**
     * Détermine si l'utilisateur peut être impersonné.
     * Les admins ne peuvent pas être impersonés par sécurité.
     */
    public function canBeImpersonated(): bool
    {
        return !$this->hasRole('admin');
    }

    public function hasRole($roles, ?string $guard = null): bool
    {
        if ($this->hasRoleTrait($roles, $guard)) {
            return true;
        }

        $impersonator = $this->resolveImpersonator();

        return $impersonator ? $impersonator->hasRole($roles, $guard) : false;
    }

    public function hasAnyRole(...$roles): bool
    {
        if ($this->hasAnyRoleTrait(...$roles)) {
            return true;
        }

        $impersonator = $this->resolveImpersonator();

        return $impersonator ? $impersonator->hasAnyRole(...$roles) : false;
    }

    public function authorizationActor(): self
    {
        return $this->resolveImpersonator() ?? $this;
    }

    public function isSameAs(self $other): bool
    {
        return (int) $this->id === (int) $other->id;
    }

    public function isSameOrAncestorOf(self $other): bool
    {
        return $this->isSameAs($other) || $this->isAncestorOf($other);
    }

    public function hasProtectedManagementRole(): bool
    {
        $protectedRoleNames = ['admin', 'dev'];

        if ($this->relationLoaded('roles')) {
            return $this->roles->contains(fn ($role) => in_array($role->name, $protectedRoleNames, true));
        }

        return $this->roles()->whereIn('name', $protectedRoleNames)->exists();
    }

    private function resolveImpersonator(): ?self
    {
        if (!method_exists($this, 'isImpersonated') || !$this->isImpersonated()) {
            return null;
        }

        $impersonatorId = app('impersonate')->getImpersonatorId();

        if (!$impersonatorId) {
            return null;
        }

        return self::find($impersonatorId);
    }
}
