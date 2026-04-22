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
     * @var array<int, string>
     */
    private const NON_DELEGABLE_PERMISSION_NAMES = [
        'users.assign_roles.all',
        'users.assign_permissions.all',
        'users.impersonate.all',
        'users.delete.all',
        'users.move.all',
    ];

    /**
     * @var array<string, array{all: string, branch: string, legacy: array<int, string>}>
     */
    private const USER_ACTION_PERMISSIONS = [
        'view' => [
            'all' => 'users.view.all',
            'branch' => 'users.view.branch',
            'legacy' => [
                'manage users',
                'create clients',
                'create suppliers',
                'create commercials',
                'create guests',
                'link commercials clients',
                'link commercials suppliers',
            ],
        ],
        'create' => [
            'all' => 'users.create.all',
            'branch' => 'users.create.branch',
            'legacy' => [
                'manage users',
                'create clients',
                'create suppliers',
                'create commercials',
                'create guests',
                'create adminstrators',
            ],
        ],
        'update' => [
            'all' => 'users.update.all',
            'branch' => 'users.update.branch',
            'legacy' => [
                'manage users',
            ],
        ],
        'delete' => [
            'all' => 'users.delete.all',
            'branch' => 'users.delete.branch',
            'legacy' => [
                'manage users',
            ],
        ],
        'move' => [
            'all' => 'users.move.all',
            'branch' => 'users.move.branch',
            'legacy' => [],
        ],
        'assign_roles' => [
            'all' => 'users.assign_roles.all',
            'branch' => 'users.assign_roles.branch',
            'legacy' => [
                'manage users',
            ],
        ],
        'assign_permissions' => [
            'all' => 'users.assign_permissions.all',
            'branch' => 'users.assign_permissions.branch',
            'legacy' => [
                'manage users',
            ],
        ],
        'impersonate' => [
            'all' => 'users.impersonate.all',
            'branch' => 'users.impersonate.branch',
            'legacy' => [],
        ],
    ];

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

        $scope = $this->resolveUserActionScope($actor, 'view');

        return $scope['all'] || $scope['branch'];
    }

    public function canView(User $actor, User $target): bool
    {
        $actor = $this->resolveActor($actor);

        if ($target->hasProtectedManagementRole() && !$this->canManageProtectedTarget($actor)) {
            return false;
        }

        return $this->canAccessTargetByScope(
            $actor,
            $target,
            'view',
            allowSelf: true,
            forbidAncestorTargets: false,
        );
    }

    public function canCreate(User $actor, ?User $parent = null, array $requestedRoleNames = []): bool
    {
        $actor = $this->resolveActor($actor);
        $scope = $this->resolveUserActionScope($actor, 'create');

        if (!$scope['all'] && !$scope['branch']) {
            return false;
        }

        if (!$this->canAssignRequestedRoles($actor, null, $requestedRoleNames)) {
            return false;
        }

        if ($parent && $parent->hasProtectedManagementRole() && !$this->canManageProtectedTarget($actor)) {
            return false;
        }

        if ($parent && $parent->isAncestorOf($actor)) {
            return false;
        }

        if ($scope['all']) {
            return true;
        }

        if ($parent === null) {
            return false;
        }

        if ($actor->isSameAs($parent)) {
            // scope['branch'] est vrai ici (all a déjà été géré) :
            // un acteur avec le droit de créer dans sa branche peut se choisir comme parent.
            return true;
        }

        return $actor->isAncestorOf($parent);
    }

    public function canCreateAny(User $actor): bool
    {
        $actor = $this->resolveActor($actor);
        $scope = $this->resolveUserActionScope($actor, 'create');

        return $scope['all'] || $scope['branch'];
    }

    public function canUpdate(User $actor, User $target): bool
    {
        $actor = $this->resolveActor($actor);

        if ($target->hasProtectedManagementRole() && !$this->canManageProtectedTarget($actor)) {
            return false;
        }

        return $this->canAccessTargetByScope(
            $actor,
            $target,
            'update',
            allowSelf: true,
            forbidAncestorTargets: true,
        );
    }

    public function canDelete(User $actor, User $target): bool
    {
        $actor = $this->resolveActor($actor);

        if ($target->hasProtectedManagementRole() && !$this->canManageProtectedTarget($actor)) {
            return false;
        }

        return $this->canAccessTargetByScope(
            $actor,
            $target,
            'delete',
            allowSelf: true,
            forbidAncestorTargets: true,
        );
    }

    public function canAssignRoles(User $actor, User $target, array $requestedRoleNames = []): bool
    {
        $actor = $this->resolveActor($actor);

        if ($target->hasProtectedManagementRole() && !$this->canManageProtectedTarget($actor)) {
            return false;
        }

        if (!$this->canAccessTargetByScope(
            $actor,
            $target,
            'assign_roles',
            allowSelf: false,
            forbidAncestorTargets: true,
        )) {
            return false;
        }

        return $this->canAssignRequestedRoles($actor, $target, $requestedRoleNames);
    }

    public function canAssignPermissions(User $actor, User $target): bool
    {
        $actor = $this->resolveActor($actor);

        if ($target->hasProtectedManagementRole() && !$this->canManageProtectedTarget($actor)) {
            return false;
        }

        return $this->canAccessTargetByScope(
            $actor,
            $target,
            'assign_permissions',
            allowSelf: false,
            forbidAncestorTargets: true,
        );
    }

    public function canMoveAny(User $actor): bool
    {
        $actor = $this->resolveActor($actor);
        $scope = $this->resolveUserActionScope($actor, 'move');
        return $scope['all'] || $scope['branch'];
    }

    public function canMove(User $actor, User $target, ?User $newParent = null): bool
    {
        $actor = $this->resolveActor($actor);
        $scope = $this->resolveUserActionScope($actor, 'move');

        if (!$scope['all'] && !$scope['branch']) {
            return false;
        }

        if ($target->hasProtectedManagementRole() && !$this->canManageProtectedTarget($actor)) {
            return false;
        }

        if (!$this->canAccessTargetByScope(
            $actor,
            $target,
            'move',
            allowSelf: false,
            forbidAncestorTargets: true,
        )) {
            return false;
        }

        if ($newParent === null) {
            return $scope['all'];
        }

        if ((int) $newParent->id === (int) $target->id) {
            return false;
        }

        if ($newParent->isDescendantOf($target)) {
            return false;
        }

        if ($newParent->hasProtectedManagementRole() && !$this->canManageProtectedTarget($actor)) {
            return false;
        }

        if ($newParent->isAncestorOf($actor)) {
            return false;
        }

        if ($scope['all']) {
            return true;
        }

        if ($actor->isSameAs($newParent)) {
            return false;
        }

        if (!$actor->isAncestorOf($newParent)) {
            return false;
        }

        return true;
    }

    public function canImpersonate(User $actor, User $target): bool
    {
        $actor = $this->resolveActor($actor);

        if ($actor->isSameAs($target)) {
            return false;
        }

        // Les comptes techniques/protegés ne doivent jamais être impersonés.
        if ($target->hasProtectedManagementRole()) {
            return false;
        }

        return $this->canAccessTargetByScope(
            $actor,
            $target,
            'impersonate',
            allowSelf: false,
            forbidAncestorTargets: true,
        );
    }

    public function canImpersonateAny(User $actor): bool
    {
        $actor = $this->resolveActor($actor);
        $scope = $this->resolveUserActionScope($actor, 'impersonate');

        return $scope['all'] || $scope['branch'];
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

        return $actor->getAllPermissions()
            ->pluck('name')
            ->filter(fn (string $name) => !in_array($name, self::NON_DELEGABLE_PERMISSION_NAMES, true))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param array<int, int> $selectedPermissionIds
     */
    public function arePermissionIdsDelegable(User $actor, User $target, array $selectedPermissionIds): bool
    {
        $selectedPermissionIds = array_values(array_unique(array_map('intval', $selectedPermissionIds)));

        if (empty($selectedPermissionIds)) {
            return true;
        }

        $assignablePermissionNames = $this->assignablePermissionNames($actor, $target);
        $assignablePermissionIds = Permission::query()
            ->whereIn('name', $assignablePermissionNames)
            ->pluck('id')
            ->map(fn ($value) => (int) $value)
            ->all();

        return array_diff($selectedPermissionIds, $assignablePermissionIds) === [];
    }

    /**
     * @param array<int, int> $selectedPermissionIds
     * @param array<int, int> $roleIds
     * @return array<int, string>
     */
    public function explicitPermissionNames(array $selectedPermissionIds, array $roleIds): array
    {
        $selectedPermissionIds = array_values(array_unique(array_map('intval', $selectedPermissionIds)));

        if (empty($selectedPermissionIds)) {
            return [];
        }

        return Permission::query()->whereIn('id', $selectedPermissionIds)->pluck('name')->all();
    }

    public function scopeManageableUsers(User $actor, Builder $query): Builder
    {
        $actor = $this->resolveActor($actor);
        $scope = $this->resolveUserActionScope($actor, 'view');

        if ($scope['all']) {
            return $query;
        }

        if (!$scope['branch']) {
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
        $scope = $this->resolveUserActionScope($actor, 'view');

        if ($scope['all']) {
            return null;
        }

        if (!$scope['branch']) {
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

        if ($target->isAncestorOf($actor)) {
            return false;
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
        $scope = $this->resolveUserActionScope($actor, 'assign_roles');

        return $scope['all'] || $scope['branch'];
    }

    private function hasLegacyCreateSelfParentCapability(User $actor): bool
    {
        $createConfig = self::USER_ACTION_PERMISSIONS['create'];

        return $actor->getAllPermissions()->pluck('name')->intersect($createConfig['legacy'])->isNotEmpty();
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
        $scope = $this->resolveUserActionScope($actor, 'view');

        return $scope['branch'];
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

    /**
     * @return array{all: bool, branch: bool}
     */
    private function resolveUserActionScope(User $actor, string $action): array
    {
        $config = self::USER_ACTION_PERMISSIONS[$action] ?? null;
        if ($config === null) {
            return ['all' => false, 'branch' => false];
        }

        $hasAll = $this->hasPermission($actor, $config['all']) || $this->isGlobalManager($actor);

        $hasBranch = $hasAll
            || $this->hasPermission($actor, $config['branch'])
            || $actor->getAllPermissions()->pluck('name')->intersect($config['legacy'])->isNotEmpty();

        return [
            'all' => $hasAll,
            'branch' => $hasBranch,
        ];
    }

    private function canManageProtectedTarget(User $actor): bool
    {
        // Compatibilite: seuls les admins globaux peuvent gerer des comptes proteges.
        return $actor->hasRole('admin');
    }

    private function canAccessTargetByScope(
        User $actor,
        User $target,
        string $action,
        bool $allowSelf,
        bool $forbidAncestorTargets,
    ): bool {
        if ($allowSelf && $actor->isSameAs($target)) {
            return true;
        }

        if ($forbidAncestorTargets && $target->isAncestorOf($actor)) {
            return false;
        }

        $scope = $this->resolveUserActionScope($actor, $action);
        if ($scope['all']) {
            return true;
        }

        if (!$scope['branch']) {
            return false;
        }

        return $actor->isAncestorOf($target);
    }
}