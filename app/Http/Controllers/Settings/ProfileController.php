<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\User;
use App\Services\UserManagementAuthorizationService;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class ProfileController extends Controller
{
    public function __construct(
        private readonly UserManagementAuthorizationService $authorization,
    ) {
    }

    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request, ?User $user = null): Response
    {
        $target = $user ?? $request->user();

        $this->authorize('update', $target);

        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $target instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            'editingUser' => $target->loadMissing(['roles', 'permissions']),
            'userAbilities' => [
                'update' => $request->user()->can('update', $target),
                'assign_roles' => $request->user()->can('assignRoles', $target),
                'assign_permissions' => $request->user()->can('assignPermissions', $target),
                'move' => $request->user()->can('move', $target),
                'delete' => $request->user()->can('delete', $target),
                'manage_db' => $this->authorization->canManageClientDatabase($request->user(), $target),
            ],
        ]);
    }

    /**
     * Show the dedicated roles/permissions page.
     */
    public function editPermissions(Request $request, ?User $user = null): Response
    {
        $target = $user ?? $request->user();

        $this->authorize('update', $target);

        return Inertia::render('settings/permissions', [
            'editingUser' => $target->loadMissing(['roles', 'permissions']),
            'allRoles' => Role::query()
                ->with('permissions:id,name')
                ->whereIn('name', $this->authorization->assignableRoleNames($request->user(), $target))
                ->get(['id', 'name']),
            'allPermissions' => Permission::query()
                ->whereIn('name', $this->authorization->assignablePermissionNames($request->user(), $target))
                ->get(['id', 'name']),
            'userAbilities' => [
                'update' => $request->user()->can('update', $target),
                'assign_roles' => $request->user()->can('assignRoles', $target),
                'assign_permissions' => $request->user()->can('assignPermissions', $target),
                'move' => $request->user()->can('move', $target),
                'delete' => $request->user()->can('delete', $target),
                'manage_db' => $this->authorization->canManageClientDatabase($request->user(), $target),
            ],
        ]);
    }

    /**
     * Update the user's profile settings.
     */
    public function update(ProfileUpdateRequest $request, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();
        Log::info('ProfileController update called', [
            'auth_id' => $request->user()?->id,
            'target_id' => $target->id,
            'route' => $request->path(),
        ]);

        $this->authorize('update', $target);

        $target->fill($request->validated());

        if ($target->isDirty('email')) {
            $target->email_verified_at = null;
        }

        $target->save();

        // Redirect back to the same edit page (preserve route name)
        return to_route('profile.edit', ['user' => $target->id])
            ->with('success', 'Profil mis a jour avec succes');
    }

    /**
     * Update only roles and permissions for a target user.
     */
    public function updatePermissions(Request $request, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();
        $actor = $request->user();

        $this->authorize('update', $target);

        $validated = $request->validate([
            'roles' => ['nullable', 'array'],
            'roles.*' => ['integer', 'exists:roles,id'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);

        if (isset($validated['roles'])) {
            $requestedRoles = Role::query()->whereIn('id', $validated['roles'])->get(['id', 'name']);
            $requestedRoleNames = $requestedRoles->pluck('name')->all();

            $this->authorize('assignRoles', [$target, $requestedRoleNames]);

            $target->syncRoles($requestedRoleNames);
        }

        if (isset($validated['permissions'])) {
            $this->authorize('assignPermissions', $target);

            $assignablePermissionNames = $this->authorization->assignablePermissionNames($actor, $target);
            $assignablePermissionIds = Permission::query()
                ->whereIn('name', $assignablePermissionNames)
                ->pluck('id')
                ->map(fn ($v) => (int) $v)
                ->all();

            $selectedPermIds = array_map('intval', $validated['permissions']);
            if (array_diff($selectedPermIds, $assignablePermissionIds) !== []) {
                abort(403, 'Unauthorized');
            }

            $roleIds = isset($validated['roles'])
                ? array_map('intval', $validated['roles'])
                : $target->roles()->pluck('id')->map(fn ($v) => (int) $v)->all();

            $inheritedPermissionIds = Permission::query()
                ->whereHas('roles', fn ($query) => $query->whereIn('id', $roleIds))
                ->pluck('id')
                ->map(fn ($v) => (int) $v)
                ->all();

            $explicitIds = array_values(array_diff($selectedPermIds, $inheritedPermissionIds));

            $permissionNames = Permission::query()
                ->whereIn('id', $explicitIds)
                ->pluck('name')
                ->all();

            $target->syncPermissions($permissionNames);
        }

        return back()->with('success', 'Roles and permissions updated successfully');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();

        // If deleting own account, require password and log out
        if ($target->id === $request->user()->id) {
            $request->validate([
                'password' => ['required', 'current_password'],
            ]);

            Auth::logout();

            $target->delete();

            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect('/');
        }

        $this->authorize('delete', $target);

        $target->delete();
        return back()->with('success', 'User deleted');
    }
}
