<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
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
use Symfony\Component\HttpFoundation\RedirectResponse as HttpFoundationRedirectResponse;

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

        $users = User::with(['roles', 'permissions'])->paginate(15);
        $roles = Role::with('permissions:id,name')->get(['id', 'name']);

        return Inertia::render('users/users', [
            'users' => Inertia::scroll(fn() => UserResource::collection($users)),
            'roles' => $roles,
        ]);
    }

    public function show(Request $request, User $user): Response
    {
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $user->load(['roles.permissions']);
        
        // Charger le parent si parent_id existe
        if ($user->parent_id) {
            $user->setAttribute('parent', User::find($user->parent_id));
        }
        
        // Extraire les permissions des rôles (role_has_permissions)
        $permissions = $user->roles->flatMap(fn($role) => $role->permissions)->unique('id')->values();
        $user->setAttribute('permissions', $permissions);

        return Inertia::render('users/show', [
            'user' => $user,
        ]);
    }


    public function edit(Request $request, User $user): Response
    {
        // Autorisation: seul l'utilisateur lui-même ou un admin peut éditer
        if ($request->user()->id !== $user->id && !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        // Charger les rôles avec leurs permissions (role_has_permissions)
        $user->load('roles.permissions');
        $permissions = $user->roles->flatMap(fn($role) => $role->permissions)->unique('id')->values();

        return Inertia::render('settings/profile', [
            // Indiquer si la cible supporte la vérification d'email
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            // Fournir l'utilisateur à éditer (peut être différent de l'utilisateur connecté)
            'editingUser' => $user->setAttribute('permissions', $permissions),
            'isEditingOther' => $request->user()->id !== $user->id,
            // Provide lists for roles and permissions to populate selects
            'allRoles' => Role::with('permissions:id,name')->get(['id', 'name']),
            'allPermissions' => Permission::all(['id', 'name']),
        ]);
    }

    public function create(Request $request): Response
    {
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        return Inertia::render('users/form', [
            // Provide lists for roles and permissions to populate selects
            'allRoles' => Role::with('permissions:id,name')->get(['id', 'name']),
            'allPermissions' => Permission::all(['id', 'name']),
        ]);
    }   

    public function store(Request $request): HttpFoundationRedirectResponse
    {
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['integer', 'exists:roles,id'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => bcrypt($validated['password']),
        ]);

        // Assign roles
        if (isset($validated['roles'])) {
            $roleNames = \Spatie\Permission\Models\Role::whereIn('id', $validated['roles'])->pluck('name')->toArray();
            $user->syncRoles($roleNames);
        }

        // Assign permissions
        if (isset($validated['permissions'])) {
            $permNames = \Spatie\Permission\Models\Permission::whereIn('id', $validated['permissions'])->pluck('name')->toArray();
            $user->syncPermissions($permNames);
        }

        // Redirige vers la page d'édition du nouvel utilisateur
        return to_route('users.edit', ['user' => $user->id]);
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
            // Determine role ids to compute inherited permissions. If roles were provided in this update
            // use them; otherwise fall back to the user's current roles.
            $roleIds = [];
            if (isset($validated['roles'])) {
                $roleIds = array_map('intval', $validated['roles']);
            } else {
                $roleIds = $user->roles()->pluck('id')->map(fn($v) => (int)$v)->toArray();
            }

            // Permissions inherited from the selected/current roles
            $inheritedPermissionIds = \Spatie\Permission\Models\Permission::whereHas('roles', function ($q) use ($roleIds) {
                $q->whereIn('id', $roleIds);
            })->pluck('id')->map(fn($v) => (int)$v)->toArray();

            // Compute explicit permissions = selected permissions minus inherited ones
            $selectedPermIds = array_map('intval', $validated['permissions']);
            $explicitIds = array_values(array_diff($selectedPermIds, $inheritedPermissionIds));

            // Sync only explicit permissions on the model (so model_has_permissions contains only overrides)
            $permNames = [];
            if (!empty($explicitIds)) {
                $permNames = \Spatie\Permission\Models\Permission::whereIn('id', $explicitIds)->pluck('name')->toArray();
            }

            $user->syncPermissions($permNames);
        }

        // Redirection vers la page d'édition du profil
        return to_route('users.edit', ['user' => $user->id]);

    }

    /**
     * Delete the user's account (fusionne ProfileController::destroy).
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        $me = $request->user();
        // Seul l'utilisateur lui-même ou un admin peut supprimer
        if ($me->id !== $user->id && !$me->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        // Si suppression de son propre compte, demander le mot de passe et déconnecter
        if ($me->id === $user->id) {
            $request->validate([
                'password' => ['required', 'current_password'],
            ]);
            \Illuminate\Support\Facades\Auth::logout();
            $user->delete();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            return redirect('/');
        }

        // Suppression par un admin
        $user->delete();
        return to_route('users.index');
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
            'attributes' => ['nullable', 'array'],
        ]);

        $dbIds = $request->input('db_ids', []);
        $attributes = $request->input('attributes', []);

        // On prépare le tableau pour sync : [db_product_id => ['attributes' => ...], ...]
        $syncData = [];
        foreach ($dbIds as $dbId) {
            $attr = $attributes[$dbId] ?? [];
            // Si c'est une string JSON (cas rare), on la décode
            if (is_string($attr)) {
                $decoded = json_decode($attr, true);
                $attr = is_array($decoded) ? $decoded : [];
            }
            $syncData[$dbId] = [
                'attributes' => json_encode($attr),
            ];
        }

        $user->dbProducts()->sync($syncData);

        return back()->with('success', 'User DB association and attributes updated successfully');
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

        // On charge les pivots pour récupérer les attributs
        $userWithPivots = $user->load(['dbProducts' => function ($q) {
            $q->select('db_products.id');
        }]);
        $selected = $userWithPivots->dbProducts->pluck('id')->toArray();

        // On prépare les attributs par db_product_id
        $dbUserAttributes = [];
        foreach ($userWithPivots->dbProducts as $dbProduct) {
            $pivot = $dbProduct->pivot;
            $attrs = [];
            if ($pivot && $pivot->attributes) {
                $decoded = json_decode($pivot->attributes, true);
                if (is_array($decoded)) $attrs = $decoded;
            }
            $dbUserAttributes[$dbProduct->id] = $attrs;
        }

        return Inertia::render('users/db', [
            'user' => $user->load(['roles', 'permissions']),
            'editingUser' => $user,
            'dbProducts' => $dbProducts,
            'selectedDbId' => $selected,
            'dbUserAttributes' => $dbUserAttributes,
        ]);
    }
}
