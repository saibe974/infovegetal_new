<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionManagementController extends Controller
{
    /**
     * Display the roles/permissions management screen.
     */
    public function index(Request $request): Response
    {
        $this->ensureAdmin($request);

        $roles = Role::query()
            ->with('permissions:id,name')
            ->orderBy('name')
            ->get(['id', 'name']);

        $permissions = Permission::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('users/roles-permissions', [
            'roles' => $roles,
            'permissions' => $permissions,
        ]);
    }

    /**
     * Create a new role.
     */
    public function storeRole(Request $request): RedirectResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('roles', 'name')],
        ]);

        Role::query()->create([
            'name' => trim($validated['name']),
            'guard_name' => 'web',
        ]);

        return back()->with('success', 'Role created successfully');
    }

    /**
     * Create a new permission.
     */
    public function storePermission(Request $request): RedirectResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('permissions', 'name')],
        ]);

        Permission::query()->create([
            'name' => trim($validated['name']),
            'guard_name' => 'web',
        ]);

        return back()->with('success', 'Permission created successfully');
    }

    /**
     * Sync all permissions attached to a role.
     */
    public function updateRolePermissions(Request $request, Role $role): RedirectResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);

        $permissionNames = Permission::query()
            ->whereIn('id', array_map('intval', $validated['permissions'] ?? []))
            ->pluck('name')
            ->all();

        $role->syncPermissions($permissionNames);

        return back()->with('success', 'Role permissions updated successfully');
    }

    /**
     * Delete a role except protected ones.
     */
    public function destroyRole(Request $request, Role $role): RedirectResponse
    {
        $this->ensureAdmin($request);

        if (in_array($role->name, ['admin', 'dev'], true)) {
            abort(403, 'Protected role');
        }

        $role->delete();

        return back()->with('success', 'Role deleted successfully');
    }

    /**
     * Delete a permission.
     */
    public function destroyPermission(Request $request, Permission $permission): RedirectResponse
    {
        $this->ensureAdmin($request);

        $permission->delete();

        return back()->with('success', 'Permission deleted successfully');
    }

    private function ensureAdmin(Request $request): void
    {
        if (!$request->user() || !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }
    }
}
