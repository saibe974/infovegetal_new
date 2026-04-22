<?php

namespace App\Policies;

use App\Models\User;
use App\Services\UserManagementAuthorizationService;

class UserPolicy
{
    public function __construct(
        private readonly UserManagementAuthorizationService $authorization,
    ) {
    }

    public function viewAny(User $user): bool
    {
        return $this->authorization->canViewAny($user);
    }

    public function view(User $user, User $target): bool
    {
        return $this->authorization->canView($user, $target);
    }

    public function create(User $user, ?User $parent = null, array $requestedRoleNames = []): bool
    {
        return $this->authorization->canCreate($user, $parent, $requestedRoleNames);
    }

    public function createAny(User $user): bool
    {
        return $this->authorization->canCreateAny($user);
    }

    public function update(User $user, User $target): bool
    {
        return $this->authorization->canUpdate($user, $target);
    }

    public function moveAny(User $user): bool
    {
        return $this->authorization->canMoveAny($user);
    }

    public function delete(User $user, User $target): bool
    {
        return $this->authorization->canDelete($user, $target);
    }

    public function assignRoles(User $user, User $target, array $requestedRoleNames = []): bool
    {
        return $this->authorization->canAssignRoles($user, $target, $requestedRoleNames);
    }

    public function assignPermissions(User $user, User $target): bool
    {
        return $this->authorization->canAssignPermissions($user, $target);
    }

    public function move(User $user, User $target, ?User $newParent = null): bool
    {
        return $this->authorization->canMove($user, $target, $newParent);
    }

    public function impersonate(User $user, User $target): bool
    {
        return $this->authorization->canImpersonate($user, $target);
    }
}