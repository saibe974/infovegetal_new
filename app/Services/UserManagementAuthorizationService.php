<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class UserManagementAuthorizationService
{
    /**
     * @var array<int, string>
     */
    private const PROTECTED_ROLE_NAMES = ['admin', 'dev'];

    /**
     * @var array<string, string>
     */
    private const ROLE_CREATION_PERMISSION_MAP = [
        'create clients' => 'client',
        'create suppliers' => 'supplier',
        'create commercials' => 'commercial',
        'create guests' => 'guest',
        'create adminstrators' => 'admin',
    ];

    /**
     * @var array<int, string>
     */
    private const HIERARCHICAL_USER_PERMISSION_NAMES = [
        'manage users',
        'create clients',
        'create suppliers',
        'create commercials',
        'create guests',
        'link commercials clients',
        'link commercials suppliers',
    ];

    /**
     * @var array<int, string>
     */
    private const OWN_CLIENT_MANAGEMENT_PERMISSION_NAMES = [
        'manage users',
        'create clients',
        'link commercials clients',
    ];

    public function resolveActor(User $actor): User
    {
        return $actor->authorizationActor();
    }

    public function canViewAny(User $actor): bool
    {
        $actor = $this->resolveActor($actor);

        return $this->isGlobalManager($actor) || $this->hasHierarchicalUserAccess($actor);
    }

    public function canView(User $actor, User $target): bool
    {
        return $this->canManageTarget($actor, $target, allowSelf: true);
    }

    public function canCreate(User $actor, ?User $parent = null, array $requestedRoleNames = []): bool
    {
        $actor = $this->resolveActor($actor);

        if (!$this->canViewAny($actor)) {
            return false;
        }

        if (!$this->canAssignRequestedRoles($actor, null, $requestedRoleNames)) {
            return false;
        }

        if ($this->isGlobalManager($actor)) {
            return true;
        }

        if ($parent === null) {
            return false;
        }

        return $actor->isSameOrAncestorOf($parent) && !$parent->hasProtectedManagementRole();
    }

    public function canUpdate(User $actor, User $target): bool
    {
        return $this->canManageTarget($actor, $target, allowSelf: true);
    }

    public function canDelete(User $actor, User $target): bool
    {
        return $this->canManageTarget($actor, $target, allowSelf: true);
    }

    public function canAssignRoles(User $actor, User $target, array $requestedRoleNames = []): bool
    {
        $actor = $this->resolveActor($actor);

        if (!$this->canManageTarget($actor, $target, allowSelf: true)) {
            return false;
        }

        return $this->canAssignRequestedRoles($actor, $target, $requestedRoleNames);
    }

    public function canAssignPermissions(User $actor, User $target): bool
    {
        $actor = $this->resolveActor($actor);

        if (!$this->canManageTarget($actor, $target, allowSelf: true)) {
            return false;
        }

        if ($this->isGlobalManager($actor)) {
            return true;
        }

        return $this->hasPermission($actor, 'manage users');
    }

    public function canMove(User $actor, User $target, ?User $newParent = null): bool
    {
        $actor = $this->resolveActor($actor);

        if (!$actor->hasRole('admin')) {
            return false;
        }

        if (!$this->canManageTarget($actor, $target, allowSelf: true)) {
            return false;
        }

        if ($newParent === null) {
            return true;
        }

        if ((int) $newParent->id === (int) $target->id) {
            return false;
        }

        if ($newParent->isDescendantOf($target)) {
            return false;
        }

        return true;
    }

    public function canManageClientDatabase(User $actor, User $target): bool
    {
        $actor = $this->resolveActor($actor);

        if (!$this->canManageTarget($actor, $target, allowSelf: false)) {
            return false;
        }

        if ($this->isGlobalManager($actor)) {
            return true;
        }

        if (!$this->hasOwnClientManagementCapability($actor)) {
            return false;
        }

        return $this->userHasRole($target, 'client');
    }

    /**
     * @return array<int, string>
     */
    public function assignableRoleNames(User $actor, ?User $target = null): array
    {
        $actor = $this->resolveActor($actor);

        if ($target && !$this->canManageTarget($actor, $target, allowSelf: true)) {
            return [];
        }

        if (!$this->hasRoleManagementCapability($actor)) {
            return [];
        }

        if ($actor->hasRole('admin')) {
            return Role::query()->pluck('name')->all();
        }

        if ($actor->hasRole('dev')) {
            return Role::query()
                ->whereNotIn('name', self::PROTECTED_ROLE_NAMES)
                ->pluck('name')
                ->all();
        }

        $actorPermissionNames = $actor->getAllPermissions()->pluck('name')->unique()->values()->all();

        return Role::query()
            ->with('permissions:id,name')
            ->whereNotIn('name', self::PROTECTED_ROLE_NAMES)
            ->get()
            ->filter(function (Role $role) use ($actorPermissionNames) {
                $rolePermissionNames = $role->permissions->pluck('name')->unique()->values()->all();

                return array_diff($rolePermissionNames, $actorPermissionNames) === [];
            })
            ->pluck('name')
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    public function assignablePermissionNames(User $actor, User $target): array
    {
        $actor = $this->resolveActor($actor);

        if (!$this->canAssignPermissions($actor, $target)) {
            return [];
        }

        if ($actor->hasRole('admin')) {
            return Permission::query()->pluck('name')->all();
        }

        return $actor->getAllPermissions()->pluck('name')->unique()->values()->all();
    }

    public function scopeManageableUsers(User $actor, Builder $query): Builder
    {
        $actor = $this->resolveActor($actor);

        if ($this->isGlobalManager($actor)) {
            return $query;
        }

        if (!$this->hasHierarchicalUserAccess($actor)) {
            return $query->whereRaw('1 = 0');
        }

        return $query
            ->where('_lft', '>=', $actor->_lft)
            ->where('_rgt', '<=', $actor->_rgt)
            ->whereDoesntHave('roles', function (Builder $roleQuery) {
                $roleQuery->whereIn('name', self::PROTECTED_ROLE_NAMES);
            });
    }

    public function treeRootParentId(User $actor): ?int
    {
        $actor = $this->resolveActor($actor);

        if ($this->isGlobalManager($actor)) {
            return null;
        }

        if (!$this->hasHierarchicalUserAccess($actor)) {
            return null;
        }

        return (int) $actor->id;
    }

    private function canManageTarget(User $actor, User $target, bool $allowSelf): bool
    {
        $actor = $this->resolveActor($actor);

        if ($allowSelf && $actor->isSameAs($target)) {
            return true;
        }

        if ($target->hasProtectedManagementRole() && !$actor->hasRole('admin')) {
            return false;
        }

        if ($this->isGlobalManager($actor)) {
            return true;
        }

        if (!$this->hasHierarchicalUserAccess($actor)) {
            return false;
        }

        return $actor->isAncestorOf($target);
    }

    private function canAssignRequestedRoles(User $actor, ?User $target, array $requestedRoleNames): bool
    {
        $actor = $this->resolveActor($actor);
        $requestedRoleNames = array_values(array_unique(array_filter($requestedRoleNames)));

        if ($target && $target->hasProtectedManagementRole() && !$actor->hasRole('admin')) {
            return false;
        }

        if (empty($requestedRoleNames)) {
            return $this->hasRoleManagementCapability($actor);
        }

        $assignableRoleNames = $this->assignableRoleNames($actor, $target);

        if (empty($assignableRoleNames)) {
            return false;
        }

        if (array_diff($requestedRoleNames, $assignableRoleNames) !== []) {
            return false;
        }

        if ($target && $actor->hasRole('admin') && $actor->isSameAs($target) && !in_array('admin', $requestedRoleNames, true)) {
            return false;
        }

        return true;
    }

    private function hasRoleManagementCapability(User $actor): bool
    {
        return $actor->hasAnyRole(['admin', 'dev']) || $this->hasPermission($actor, 'manage users');
    }

    private function hasOwnClientManagementCapability(User $actor): bool
    {
        $permissionNames = $actor->getAllPermissions()->pluck('name');

        return $permissionNames->intersect(self::OWN_CLIENT_MANAGEMENT_PERMISSION_NAMES)->isNotEmpty();
    }

    private function isGlobalManager(User $actor): bool
    {
        return $actor->hasAnyRole(['admin', 'dev']);
    }

    private function hasHierarchicalUserAccess(User $actor): bool
    {
        $permissionNames = $actor->getAllPermissions()->pluck('name');

        return $permissionNames->intersect(self::HIERARCHICAL_USER_PERMISSION_NAMES)->isNotEmpty();
    }

    private function hasPermission(User $actor, string $permissionName): bool
    {
        return $actor->getAllPermissions()->contains('name', $permissionName);
    }

    private function userHasRole(User $user, string $roleName): bool
    {
        if ($user->relationLoaded('roles')) {
            return $user->roles->contains(fn ($role) => $role->name === $roleName);
        }

        return $user->roles()->where('name', $roleName)->exists();
    }
}