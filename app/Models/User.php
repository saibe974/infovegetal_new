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
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use App\Services\UserManagementAuthorizationService;

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
     * Many-to-many relation to DbProducts via pivot `db_product_user`.
     */
    public function dbProducts(): BelongsToMany
    {
        return $this->belongsToMany(
            \App\Models\DbProducts::class,
            'db_product_user',
            'user_id',
            'db_product_id',
        )
            ->withTimestamps()
            ->withPivot(['can_access', 'can_buy', 'can_invoice', 'can_sell', 'can_manage', 'attributes']);
    }

    /**
     * DB products where the user is configured as billing user.
     */
    public function billingDbProducts(): BelongsToMany
    {
        return $this->belongsToMany(
            \App\Models\DbProducts::class,
            'db_product_billing_user',
            'billing_user_id',
            'db_product_id',
        )
            ->withTimestamps()
            ->withPivot(['defaults', 'active']);
    }

    public function sellerDbProducts(): BelongsToMany
    {
        return $this->belongsToMany(
            \App\Models\DbProducts::class,
            'db_product_seller_user',
            'seller_user_id',
            'db_product_id',
        )
            ->withTimestamps()
            ->withPivot(['billing_user_id', 'conditions', 'use_billing_profile', 'billing_profile_id', 'seller_defaults', 'can_manage', 'active']);
    }

    public function dbProductSellerRules(): HasMany
    {
        return $this->hasMany(DbProductSellerUser::class, 'seller_user_id');
    }

    /**
     * Sellers linked to this billing user.
     */
    public function sellers(): BelongsToMany
    {
        return $this->belongsToMany(
            self::class,
            'billing_user_seller_user',
            'billing_user_id',
            'seller_user_id',
        )
            ->withTimestamps()
            ->withPivot(['active', 'conditions_override']);
    }

    /**
     * Billing users linked to this seller.
     */
    public function billingUsers(): BelongsToMany
    {
        return $this->belongsToMany(
            self::class,
            'billing_user_seller_user',
            'seller_user_id',
            'billing_user_id',
        )
            ->withTimestamps()
            ->withPivot(['active', 'conditions_override']);
    }

    /**
     * Final client conditions entries.
     */
    public function clientSalesConditions(): HasMany
    {
        return $this->hasMany(ClientSalesCondition::class, 'client_user_id');
    }

    /**
     * User custom key/value metadata.
     */
    public function usersMeta(): HasMany
    {
        return $this->hasMany(UserMeta::class);
    }

    public function clientOrders(): HasMany
    {
        return $this->hasMany(OrderHeader::class, 'client_user_id');
    }

    public function billingOrders(): HasMany
    {
        return $this->hasMany(OrderHeader::class, 'billing_user_id');
    }

    public function sellerOrders(): HasMany
    {
        return $this->hasMany(OrderHeader::class, 'seller_user_id');
    }

    /**
     * Media collections for user profile assets.
     */
    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('user_logos');
        $this->addMediaCollection('user_photos');
        $this->addMediaCollection('user_meta_files');
    }

    public function registerMediaConversions(?Media $media = null): void
    {
    }

    /**
     * Détermine si l'utilisateur peut impersonner d'autres utilisateurs.
     * Seuls les admins peuvent impersonner.
     */
    public function canImpersonate(): bool
    {
        $authorization = app(UserManagementAuthorizationService::class);

        return $authorization->canImpersonateAny($this) || $this->hasRoleTrait('admin');
    }

    /**
     * Détermine si l'utilisateur peut être impersonné.
     * Les admins ne peuvent pas être impersonés par sécurité.
     */
    public function canBeImpersonated(): bool
    {
        return !$this->hasProtectedManagementRole();
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
        if ($this->isImpersonationStrictModeEnabled()) {
            return null;
        }

        if (!method_exists($this, 'isImpersonated') || !$this->isImpersonated()) {
            return null;
        }

        $impersonatorId = app('impersonate')->getImpersonatorId();

        if (!$impersonatorId) {
            return null;
        }

        // Garde-fou: si l'ID impersonateur pointe sur l'utilisateur courant,
        // on évite la récursion hasRole/hasAnyRole -> resolveImpersonator -> hasRole...
        if ((int) $impersonatorId === (int) $this->id) {
            return null;
        }

        return self::find($impersonatorId);
    }

    private function isImpersonationStrictModeEnabled(): bool
    {
        if (!app()->bound('request')) {
            return false;
        }

        $request = request();

        if (!$request || !$request->hasSession()) {
            return false;
        }

        return (bool) $request->session()->get('impersonation.strict_mode', false);
    }
}
