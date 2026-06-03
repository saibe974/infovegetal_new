<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\Exceptions\UnauthorizedException;

class ImpersonateRoleOrPermissionMiddleware
{
    public function handle(Request $request, Closure $next, string $roleOrPermission, ?string $guard = null)
    {
        $user = $request->user();

        if (!$user) {
            throw UnauthorizedException::notLoggedIn();
        }

        $rolesOrPermissions = array_values(array_filter(preg_split('/[|,]/', $roleOrPermission) ?: []));

        if ($this->userHasAccess($user, $rolesOrPermissions, $guard)) {
            return $next($request);
        }

        $impersonator = $this->resolveImpersonator($user, $request);

        if ($impersonator && $this->userHasAccess($impersonator, $rolesOrPermissions, $guard)) {
            return $next($request);
        }

        throw UnauthorizedException::forRolesOrPermissions($rolesOrPermissions);
    }

    /**
     * @param array<int, string> $rolesOrPermissions
     */
    private function userHasAccess(User $user, array $rolesOrPermissions, ?string $guard): bool
    {
        if (count($rolesOrPermissions) === 0) {
            return false;
        }

        // Mirror Spatie RoleOrPermission behavior: accept either role or permission.
        $hasRole = $guard
            ? $user->hasAnyRole($rolesOrPermissions, $guard)
            : $user->hasAnyRole($rolesOrPermissions);

        return $user->canAny($rolesOrPermissions) || $hasRole;
    }

    private function resolveImpersonator(User $user, Request $request): ?User
    {
        if ($request->hasSession() && (bool) $request->session()->get('impersonation.strict_mode', false)) {
            return null;
        }

        if (!method_exists($user, 'isImpersonated') || !$user->isImpersonated()) {
            return null;
        }

        $impersonatorId = app('impersonate')->getImpersonatorId();

        if (!$impersonatorId) {
            return null;
        }

        if ((int) $impersonatorId === (int) $user->getKey()) {
            return null;
        }

        return User::find($impersonatorId);
    }
}
