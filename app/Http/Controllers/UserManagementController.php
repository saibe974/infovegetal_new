<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate as FacadesGate;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\DbProducts;

class UserManagementController extends Controller
{
    /**
     * Show the users management page.
     */
    public function index(Request $request): Response
    {
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $users = User::with(['roles', 'permissions'])->get();
        $roles = Role::all(['id', 'name']);

        return Inertia::render('users/users', [
            'users' => $users,
            'roles' => $roles,
        ]);
    }

    public function edit(Request $request, User $user): Response
    {
        // Autorisation: seul l'utilisateur lui-même ou un admin peut éditer
        if ($request->user()->id !== $user->id && !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        return Inertia::render('settings/profile', [
            // Indiquer si la cible supporte la vérification d'email
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            // Fournir l'utilisateur à éditer (peut être différent de l'utilisateur connecté)
            'editingUser' => $user->load(['roles', 'permissions']),
            'isEditingOther' => $request->user()->id !== $user->id,
            // Provide lists for roles and permissions to populate selects
            'allRoles' => Role::all(['id', 'name']),
            'allPermissions' => Permission::all(['id', 'name']),
        ]);
    }

    /**
     * Update a user's role.
     */
    public function updateRole(Request $request, User $user): RedirectResponse
    {
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        // Ne pas permettre à un admin de modifier son propre rôle
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'You cannot modify your own role');
        }

        $request->validate([
            'role' => ['required', 'string', 'exists:roles,name'],
        ]);

        // Supprimer tous les rôles existants et assigner le nouveau
        $user->syncRoles([$request->role]);

        return back()->with('success', 'User role updated successfully');
    }

    /**
     * Update user's basic info, roles and permissions (admin or self limited).
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        // Only admin or the user itself can update
        $me = $request->user();
        if ($me->id !== $user->id && !$me->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['integer', 'exists:roles,id'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ];

        $validated = $request->validate($rules);

        // Update basic fields
        $user->name = $validated['name'];
        $user->email = $validated['email'];
        $user->save();

        // Roles: only admin can change roles; additionally prevent admin from removing own admin role
        if (isset($validated['roles'])) {
            if (!$me->hasRole('admin')) {
                // non-admin cannot change roles
                // ignore
            } else {
                // If admin is editing themselves, disallow removing own admin role
                if ($me->id === $user->id) {
                    // ensure admin role remains
                    $current = collect($validated['roles']);
                    $adminRole = \Spatie\Permission\Models\Role::where('name', 'admin')->value('id');
                    if ($adminRole && !$current->contains((int)$adminRole)) {
                        return back()->with('error', 'You cannot remove your own admin role');
                    }
                }

                // sync by role ids
                $roleNames = \Spatie\Permission\Models\Role::whereIn('id', $validated['roles'])->pluck('name')->toArray();
                $user->syncRoles($roleNames);
            }
        }

        // Permissions: only admin can change
        if (isset($validated['permissions']) && $me->hasRole('admin')) {
            $permNames = \Spatie\Permission\Models\Permission::whereIn('id', $validated['permissions'])->pluck('name')->toArray();
            $user->syncPermissions($permNames);
        }

        return back()->with('success', 'User updated successfully');
    }

    /**
     * Reorder users with nested set structure.
     * Payload: { items: [{ id, parent_id|null, position } ...] }
     */
    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required','array'],
            'items.*.id' => ['required','integer','exists:users,id'],
            'items.*.parent_id' => ['nullable','integer','exists:users,id'],
            'items.*.position' => ['required','integer','min:0'],
        ]);

        return DB::transaction(function () use ($validated) {
            $rows = collect($validated['items']);

            // Sécurité anti-cycles simple : parent_id != id
            foreach ($rows as $r) {
                if (!is_null($r['parent_id']) && (int)$r['parent_id'] === (int)$r['id']) {
                    abort(422, 'Invalid parent.');
                }
            }

            // Anti-cycles basique via parcours parent -> racine
            $rows->each(function ($r) use ($rows) {
                $parentId = $r['parent_id'];
                $visited = [];
                while ($parentId !== null) {
                    if (in_array($parentId, $visited, true)) {
                        abort(422, 'Circular parent reference detected.');
                    }
                    $visited[] = $parentId;
                    $parent = $rows->firstWhere('id', $parentId);
                    $parentId = $parent ? $parent['parent_id'] : null;
                    if (count($visited) > 1000) break; // garde-fou
                }
            });

            $groups = $rows->groupBy(fn($r) => $r['parent_id'] ?? null);

            // Détacher puis reconstruire l'arbre pour éviter toute corruption
            $allIds = $rows->pluck('id')->toArray();
            $allNodes = User::whereIn('id', $allIds)->get();

            foreach ($allNodes as $node) {
                $node->parent_id = null;
                $node->save();
            }

            $placeChildren = function ($parentId) use (&$placeChildren, $groups) {
                $children = ($groups->get($parentId, collect()))->sortBy('position')->values();
                $prev = null;

                foreach ($children as $r) {
                    $node = User::findOrFail($r['id']);
                    $node->refresh();

                    if ($parentId === null) {
                        $node->saveAsRoot();
                    } else {
                        $parent = User::findOrFail($parentId);
                        $parent->refresh();
                        $node->appendToNode($parent)->save();
                    }

                    if ($prev) {
                        $prev->refresh();
                        $node->afterNode($prev)->save();
                    }

                    $prev = $node;

                    $placeChildren($node->id);
                }
            };

            $placeChildren(null);

            return response()->json(['ok' => true]);
        });
    }

    public function editDb(Request $request, User $user): RedirectResponse
    {
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $request->validate([
            'db_ids' => ['nullable', 'array'],
            'db_ids.*' => ['integer', 'exists:db_products,id'],
        ]);

        $dbIds = $request->input('db_ids', []);

        // Normalize to array of ints
        $dbIds = is_array($dbIds) ? array_map('intval', $dbIds) : [];

        // Sync the many-to-many pivot
        $user->dbProducts()->sync($dbIds);

        return back()->with('success', 'User DB association updated successfully');
    }   

    /**
     * Export users as CSV.
     */
    public function export(Request $request)
    {
        $filename = 'users_export_' . date('Ymd_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['id', 'email', 'name', 'roles', 'permissions'], ';');

            User::with(['roles:id,name', 'permissions:id,name'])->chunk(100, function ($users) use ($handle) {
                foreach ($users as $u) {
                    fputcsv($handle, [
                        $u->id,
                        $u->email,
                        $u->name,
                        $u->roles->pluck('name')->implode('|'),
                        $u->permissions->pluck('name')->implode('|'),
                    ], ';');
                }
            });

            fclose($handle);
        };

        return new StreamedResponse($callback, 200, $headers);
    }

    /**
     * Show the DB association form for a user.
     */
    public function db(Request $request, User $user): Response
    {
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $dbProducts = DbProducts::orderBy('name')->get(['id', 'name']);

        $selected = $user->dbProducts()->pluck('db_products.id')->toArray();

        return Inertia::render('users/db', [
            'user' => $user->load(['roles', 'permissions']),
            'dbProducts' => $dbProducts,
            'selectedDbId' => $selected,
        ]);
    }
}
