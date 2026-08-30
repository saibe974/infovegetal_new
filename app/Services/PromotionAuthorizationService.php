<?php

namespace App\Services;

use App\Models\Promotion;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

final class PromotionAuthorizationService
{
    public function resolveActor(User $user): User
    {
        return $user->authorizationActor();
    }

    public function canViewModule(User $user): bool
    {
        $actor = $this->resolveActor($user);

        return $this->canManageModule($actor)
            || $actor->getAllPermissions()->contains('name', 'promo.view');
    }

    public function canManageModule(User $user): bool
    {
        $actor = $this->resolveActor($user);

        return $this->isEligibleManager($actor);
    }

    public function canManageAll(User $user): bool
    {
        $actor = $this->resolveActor($user);

        return $actor->hasRole('admin')
            || $actor->getAllPermissions()->contains('name', 'promo.manage.all');
    }

    public function canView(User $user, Promotion $promotion): bool
    {
        $actor = $this->resolveActor($user);

        if (! $this->canViewModule($actor)) {
            return false;
        }

        return $this->canManageAll($actor)
            || (int) $promotion->created_by_id === (int) $actor->id
            || (int) $promotion->responsible_user_id === (int) $actor->id;
    }

    public function canUpdate(User $user, Promotion $promotion): bool
    {
        return $this->canManageModule($user) && $this->canView($user, $promotion);
    }

    public function scopeVisible(User $user, Builder $query): Builder
    {
        $actor = $this->resolveActor($user);

        if ($this->canManageAll($actor)) {
            return $query;
        }

        return $query->where(function (Builder $scopeQuery) use ($actor): void {
            $scopeQuery
                ->where('created_by_id', $actor->id)
                ->orWhere('responsible_user_id', $actor->id);
        });
    }

    public function isEligibleManager(User $user): bool
    {
        if ($user->roles()->whereIn('name', ['admin', 'commercial'])->exists()) {
            return true;
        }

        if ($user->getAllPermissions()->contains('name', 'promo.manage')) {
            return true;
        }

        return $user->sellerDbProducts()->wherePivot('active', true)->exists()
            || $user->billingDbProducts()->wherePivot('active', true)->exists();
    }

    public function canAssignResponsible(User $actor, User $responsible): bool
    {
        $actor = $this->resolveActor($actor);

        if (! $this->isEligibleManager($responsible)) {
            return false;
        }

        return $this->canManageAll($actor) || $actor->isSameAs($responsible);
    }

    public function eligibleManagers(User $user): Builder
    {
        $actor = $this->resolveActor($user);
        $query = User::query()->where('active', true);

        if (! $this->canManageAll($actor)) {
            return $query->whereKey($actor->id);
        }

        return $query->where(function (Builder $managerQuery): void {
            $managerQuery
                ->whereHas('roles', fn (Builder $roleQuery) => $roleQuery
                    ->whereIn('name', ['admin', 'commercial']))
                ->orWhereHas('permissions', fn (Builder $permissionQuery) => $permissionQuery
                    ->where('name', 'promo.manage'))
                ->orWhereHas('roles.permissions', fn (Builder $permissionQuery) => $permissionQuery
                    ->where('name', 'promo.manage'))
                ->orWhereHas('sellerDbProducts', fn (Builder $dbQuery) => $dbQuery
                    ->where('db_product_seller_user.active', true))
                ->orWhereHas('billingDbProducts', fn (Builder $dbQuery) => $dbQuery
                    ->where('db_product_billing_user.active', true));
        });
    }
}
