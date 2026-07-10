<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Http\Requests\Users\UserPermissionsUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\User;
use App\Models\UserOption;
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

        $target->loadMissing(['roles', 'permissions', 'usersMeta']);

        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $target instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            'editingUser' => $target,
            'userAbilities' => [
                'update' => $request->user()->can('update', $target),
                'assign_roles' => $request->user()->can('assignRoles', $target),
                'assign_permissions' => $request->user()->can('assignPermissions', $target),
                'move' => $request->user()->can('move', $target),
                'impersonate' => $request->user()->can('impersonate', $target),
                'delete' => $request->user()->can('delete', $target),
                'manage_db' => $this->authorization->canManageClientDatabase($request->user(), $target),
            ],
            'userMeta' => $target->usersMeta()
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get(['id', 'user_id', 'key', 'value', 'type', 'sort_order']),
            'metaKeyOptions' => UserOption::query()
                ->where('key', 'users_meta.allowed_key')
                ->where('active', true)
                ->orderBy('sort_order')
                ->get(['value', 'label'])
                ->map(fn (UserOption $row) => [
                    'value' => (string) $row->value,
                    'label' => (string) ($row->label ?: $row->value),
                ])
                ->values()
                ->all(),
            'metaKeyConfig' => $this->metaKeyConfig(),
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
                'impersonate' => $request->user()->can('impersonate', $target),
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
        return to_route('profile.edit')
            ->with('success', 'Profil mis a jour avec succes');
    }

    /**
     * Update only roles and permissions for a target user.
     */
    public function updatePermissions(UserPermissionsUpdateRequest $request, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();
        $actor = $request->user();

        $this->authorize('update', $target);

        $validated = $request->validated();

        if (isset($validated['roles'])) {
            $requestedRoles = Role::query()->whereIn('id', $validated['roles'])->get(['id', 'name']);
            $requestedRoleNames = $requestedRoles->pluck('name')->all();

            $this->authorize('assignRoles', [$target, $requestedRoleNames]);

            $target->syncRoles($requestedRoleNames);
        }

        if (isset($validated['permissions'])) {
            $this->authorize('assignPermissions', $target);
            $selectedPermIds = array_map('intval', $validated['permissions']);
            if (!$this->authorization->arePermissionIdsDelegable($actor, $target, $selectedPermIds)) {
                abort(403, 'Unauthorized');
            }

            $roleIds = isset($validated['roles'])
                ? array_map('intval', $validated['roles'])
                : $target->roles()->pluck('id')->map(fn ($v) => (int) $v)->all();

            $permissionNames = $this->authorization->explicitPermissionNames($selectedPermIds, $roleIds);

            $target->syncPermissions($permissionNames);
        }

        return back()->with('success', 'Roles and permissions updated successfully');
    }

    private function metaKeyConfig(): array
    {
        $kinds = UserOption::query()
            ->where('key', 'users_meta.input_kind')
            ->where('active', true)
            ->get(['value', 'label', 'type'])
            ->keyBy('value');

        $fields = UserOption::query()
            ->where('key', 'users_meta.input_fields')
            ->where('active', true)
            ->get(['value', 'label'])
            ->keyBy('value');

        $config = [];
        foreach ($kinds as $value => $row) {
            $fieldRow = $fields->get($value);
            $config[$value] = [
                'input' => (string) ($row->label ?: $row->type ?: 'input'),
                'fields' => $fieldRow && $fieldRow->label
                    ? array_values(array_filter(array_map('trim', explode(',', (string) $fieldRow->label))))
                    : [],
            ];
        }

        return $config;
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
