<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\Exceptions\UnauthorizedException;

class ImpersonateRoleMiddleware
{
    public function handle(Request $request, Closure $next, string $role, ?string $guard = null)
    {
        $user = $request->user();

        if (!$user) {
            throw UnauthorizedException::notLoggedIn();
        }

        $roles = array_filter(preg_split('/[|,]/', $role) ?: []);

        if ($this->userHasRole($user, $roles, $guard)) {
            return $next($request);
        }

        $impersonator = $this->resolveImpersonator($user);

        if ($impersonator && $this->userHasRole($impersonator, $roles, $guard)) {
            return $next($request);
        }

        throw UnauthorizedException::forRoles($roles);
    }

    /**
     * @param array<int, string> $roles
     */
    private function userHasRole(User $user, array $roles, ?string $guard): bool
    {
        if (count($roles) === 0) {
            return false;
        }

        return $guard
            ? $user->hasAnyRole($roles, $guard)
            : $user->hasAnyRole($roles);
    }

    private function resolveImpersonator(User $user): ?User
    {
        if (!method_exists($user, 'isImpersonated') || !$user->isImpersonated()) {
            return null;
        }

        $impersonatorId = app('impersonate')->getImpersonatorId();

        if (!$impersonatorId) {
            return null;
        }

        return User::find($impersonatorId);
    }
}
