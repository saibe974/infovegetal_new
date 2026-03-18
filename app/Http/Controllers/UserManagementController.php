<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate as FacadesGate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\DbProducts;
use Symfony\Component\HttpFoundation\RedirectResponse as HttpFoundationRedirectResponse;

use function Illuminate\Log\log;

class UserManagementController extends Controller
{
    /**
     * Show the users management page.
     */
    public function index(Request $request): Response
    {
        if (!$request->user()->hasAnyRole(['admin', 'dev'])) {
            abort(403, 'Unauthorized');
        }

        $query = User::with(['roles', 'permissions']);
        
        $search = $request->get('q');
        if ($search) {
            $normalized = trim($search);
            $tokens = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $isSingleNumeric = count($tokens) === 1 && ctype_digit($tokens[0]);

            $query->where(function ($q) use ($tokens, $isSingleNumeric) {
                // Si un seul terme numérique, tenter l'ID exact
                if ($isSingleNumeric) {
                    $q->where('id', '=', (int) $tokens[0]);
                }

                // Et toujours proposer une recherche sur le nom qui contient tous les termes
                $q->orWhere(function ($qq) use ($tokens) {
                    foreach ($tokens as $t) {
                        $qq->where('name', 'like', '%' . $t . '%');
                    }
                });
            });
        }

        $users = $query->orderBy('_lft', 'asc')->paginate(24);
        $roles = Role::with('permissions:id,name')->get(['id', 'name']);

        return Inertia::render('users/index', [
            'q' => $search,
            'collection' => Inertia::scroll(fn() => UserResource::collection($users)),
            'roles' => $roles,
            'searchPropositions' => Inertia::optional(fn() => $this->getSearchPropositions($query, $search)),
        ]);
    }

    /**
     * Lazy-load direct children for a branch of the users tree.
     */
    public function treeChildren(Request $request): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['admin', 'dev'])) {
            abort(403, 'Unauthorized');
        }

        $validated = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:users,id'],
            'offset' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'q' => ['nullable', 'string', 'max:255'],
        ]);

        $parentId = array_key_exists('parent_id', $validated)
            ? ($validated['parent_id'] !== null ? (int) $validated['parent_id'] : null)
            : null;

        $offset = (int) ($validated['offset'] ?? 0);
        $limit = (int) ($validated['limit'] ?? 30);
        $search = trim((string) ($validated['q'] ?? ''));

        $query = User::query()
            ->select([
                'id',
                'name',
                'email',
                'active',
                'parent_id',
                '_lft',
                '_rgt',
            ])
            ->where('parent_id', $parentId)
            ->orderBy('_lft', 'asc');

        if ($search !== '') {
            $tokens = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $isSingleNumeric = count($tokens) === 1 && ctype_digit($tokens[0]);

            $query->where(function ($q) use ($tokens, $isSingleNumeric) {
                if ($isSingleNumeric) {
                    $q->where('id', '=', (int) $tokens[0]);
                }

                $q->orWhere(function ($qq) use ($tokens) {
                    foreach ($tokens as $token) {
                        $qq->where('name', 'like', '%' . $token . '%');
                    }
                });
            });
        }

        $total = (clone $query)->count();
        $users = $query->offset($offset)->limit($limit)->get();

        $userIds = $users->pluck('id')->map(fn ($id) => (int) $id)->all();
        $parentsWithChildren = [];

        if (!empty($userIds)) {
            $parentsWithChildren = User::query()
                ->whereIn('parent_id', $userIds)
                ->whereNotNull('parent_id')
                ->distinct()
                ->pluck('parent_id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        $hasChildrenLookup = array_fill_keys($parentsWithChildren, true);

        $items = $users->map(function (User $user) use ($parentId) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'active' => (bool) $user->active,
                'parent_id' => $user->parent_id,
                '_lft' => $user->_lft,
                '_rgt' => $user->_rgt,
                'depth' => $parentId === null ? 0 : null,
                'has_children' => false,
            ];
        })->map(function (array $item) use ($hasChildrenLookup) {
            $item['has_children'] = isset($hasChildrenLookup[(int) $item['id']]);
            return $item;
        })->values();

        $nextOffset = $offset + $items->count();

        return response()->json([
            'items' => $items,
            'offset' => $offset,
            'next_offset' => $nextOffset,
            'limit' => $limit,
            'total' => $total,
            'has_more' => $nextOffset < $total,
        ]);
    }

    /**
     * Return only matching users and their ancestor chain as a tree fragment.
     */
    public function treeSearch(Request $request): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['admin', 'dev'])) {
            abort(403, 'Unauthorized');
        }

        $validated = $request->validate([
            'q' => ['required', 'string', 'max:255'],
        ]);

        $search = trim((string) $validated['q']);
        if ($search === '') {
            return response()->json([
                'items' => [],
                'expanded_ids' => [],
                'matched_ids' => [],
            ]);
        }

        $tokens = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $isSingleNumeric = count($tokens) === 1 && ctype_digit($tokens[0]);

        $matchedIds = User::query()
            ->select('id')
            ->where(function ($q) use ($tokens, $isSingleNumeric) {
                if ($isSingleNumeric) {
                    $q->where('id', '=', (int) $tokens[0]);
                }

                $q->orWhere(function ($qq) use ($tokens) {
                    foreach ($tokens as $token) {
                        $qq->where('name', 'like', '%' . $token . '%');
                    }
                });
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (empty($matchedIds)) {
            return response()->json([
                'items' => [],
                'expanded_ids' => [],
                'matched_ids' => [],
            ]);
        }

        $allUsers = User::query()
            ->select(['id', 'name', 'email', 'active', 'parent_id', '_lft', '_rgt'])
            ->orderBy('_lft', 'asc')
            ->get();

        $byId = $allUsers->keyBy('id');
        $keepIds = [];

        foreach ($matchedIds as $matchedId) {
            $cursor = $matchedId;

            while ($cursor !== null && !isset($keepIds[$cursor])) {
                $keepIds[$cursor] = true;
                $node = $byId->get($cursor);

                if (!$node) {
                    break;
                }

                $cursor = $node->parent_id !== null ? (int) $node->parent_id : null;
            }
        }

        $subset = $allUsers
            ->filter(fn (User $user) => isset($keepIds[(int) $user->id]))
            ->values();

        $subsetChildrenByParent = [];
        foreach ($subset as $node) {
            $pid = $node->parent_id !== null ? (int) $node->parent_id : null;
            if ($pid === null) {
                continue;
            }

            $subsetChildrenByParent[$pid] = true;
        }

        $items = $subset->map(function (User $user) use ($keepIds, $subsetChildrenByParent, $byId) {
            $depth = 0;
            $cursor = $user->parent_id !== null ? (int) $user->parent_id : null;

            while ($cursor !== null && isset($keepIds[$cursor])) {
                $depth++;
                $parent = $byId->get($cursor);
                if (!$parent) {
                    break;
                }
                $cursor = $parent->parent_id !== null ? (int) $parent->parent_id : null;
            }

            return [
                'id' => (int) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'active' => (bool) $user->active,
                'parent_id' => $user->parent_id,
                '_lft' => $user->_lft,
                '_rgt' => $user->_rgt,
                'depth' => $depth,
                'has_children' => isset($subsetChildrenByParent[(int) $user->id]),
            ];
        })->values();

        $expandedIds = collect($items)
            ->filter(fn (array $item) => (bool) ($item['has_children'] ?? false))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        return response()->json([
            'items' => $items,
            'expanded_ids' => $expandedIds,
            'matched_ids' => array_values(array_unique($matchedIds)),
        ]);
    }

    public function show(Request $request, User $user): Response
    {
        if (!$request->user()->hasAnyRole(['admin', 'dev'])) {
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
        // Autorisation: seul l'utilisateur lui-même, un admin ou un dev peut éditer
        if ($request->user()->id !== $user->id && !$request->user()->hasAnyRole(['admin', 'dev'])) {
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
    {Log::info("Creating new user by " . $request->user()->id);
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'alias' => ['nullable', 'string', 'max:255', 'unique:users,alias'],
            'ref' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:25'],
            'address_road' => ['nullable', 'string', 'max:255'],
            'address_zip' => ['nullable', 'string', 'max:32'],
            'address_town' => ['nullable', 'string', 'max:120'],
            'active' => ['sometimes', 'boolean'],
            'mailing' => ['sometimes', 'boolean'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'roles' => ['sometimes', 'array'],
            'roles.*' => ['integer', 'exists:roles,id'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);

        // Crée le noeud racine immédiatement pour initialiser _lft/_rgt (nested set)
        $user = new User([
            'name' => $validated['name'],
            'alias' => $validated['alias'] ?? null,
            'ref' => $validated['ref'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'address_road' => $validated['address_road'] ?? null,
            'address_zip' => $validated['address_zip'] ?? null,
            'address_town' => $validated['address_town'] ?? null,
            'active' => array_key_exists('active', $validated) ? (bool) $validated['active'] : true,
            'mailing' => array_key_exists('mailing', $validated) ? (bool) $validated['mailing'] : false,
            'email' => $validated['email'],
            'password' => bcrypt($validated['password']),
        ]);

        // Positionner le nouvel utilisateur comme racine par défaut
        $user->saveAsRoot();

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
        $me = $request->user();
        Log::info("Updating user $user->id by $me->id");
        $isAdmin = $me->hasRole('admin');
        $isDev = $me->hasRole('dev');

        if ($me->id !== $user->id && !$me->hasAnyRole(['admin', 'dev'])) {
            abort(403, 'Unauthorized');
        }


        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'alias' => ['nullable', 'string', 'max:255', 'unique:users,alias,' . $user->id],
            'ref' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:25'],
            'address_road' => ['nullable', 'string', 'max:255'],
            'address_zip' => ['nullable', 'string', 'max:32'],
            'address_town' => ['nullable', 'string', 'max:120'],
            'active' => ['nullable', 'boolean'],
            'mailing' => ['nullable', 'boolean'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['integer', 'exists:roles,id'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ];

        $validated = $request->validate($rules);

        if ($me->id === $user->id || $isAdmin) {
            $user->name = $validated['name'];
            $user->alias = $validated['alias'] ?? null;
            $user->ref = $validated['ref'] ?? null;
            $user->phone = $validated['phone'] ?? null;
            $user->address_road = $validated['address_road'] ?? null;
            $user->address_zip = $validated['address_zip'] ?? null;
            $user->address_town = $validated['address_town'] ?? null;
            $user->active = array_key_exists('active', $validated) ? (bool) $validated['active'] : $user->active;
            $user->mailing = array_key_exists('mailing', $validated) ? (bool) $validated['mailing'] : $user->mailing;
            $user->email = $validated['email'];
            $user->save();
        }

        // Roles: admins can manage all roles, devs can manage non-protected roles only.
        if (isset($validated['roles'])) {
            if (!$isAdmin && !$isDev) {
            } else {
                $requestedRoles = \Spatie\Permission\Models\Role::whereIn('id', $validated['roles'])->get(['id', 'name']);

                if ($isDev && !$isAdmin) {
                    $protectedRoleNames = ['admin', 'dev'];
                    $requestedRoleNames = $requestedRoles->pluck('name')->toArray();
                    $targetHasProtectedRole = $user->roles()->whereIn('name', $protectedRoleNames)->exists();

                    if ($targetHasProtectedRole) {
                        return back()->with('error', 'Les comptes admin et dev ne peuvent pas être modifiés par un dev');
                    }

                    if (!empty(array_intersect($requestedRoleNames, $protectedRoleNames))) {
                        return back()->with('error', 'Un dev ne peut pas attribuer les rôles admin ou dev');
                    }
                }

                // If the real admin account is editing itself, disallow removing own admin role.
                // In impersonation mode, $me is the impersonated user, so we must resolve the impersonator id.
                $actorId = $me->id;
                if ($isAdmin && method_exists($me, 'isImpersonated') && $me->isImpersonated()) {
                    $impersonatorId = app('impersonate')->getImpersonatorId();
                    if ($impersonatorId) {
                        $actorId = (int) $impersonatorId;
                    }
                }

                if ($isAdmin && (int) $actorId === (int) $user->id) {
                    // ensure admin role remains
                    $current = collect($validated['roles']);
                    $adminRole = \Spatie\Permission\Models\Role::where('name', 'admin')->value('id');
                    if ($adminRole && !$current->contains((int)$adminRole)) {
                        return back()->with('error', 'You cannot remove your own admin role');
                    }
                }

                // sync by role ids
                $user->syncRoles($requestedRoles->pluck('name')->toArray());
            }
        }

        // Permissions: only admin can change
        if (isset($validated['permissions']) && $isAdmin) {
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

        // Redirection vers la page d'édition du profil avec confirmation visuelle
        return to_route('users.edit', ['user' => $user->id])
            ->with('success', 'Utilisateur mis a jour avec succes');

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
        $requestId = (string) \Illuminate\Support\Str::uuid();
        $startedAt = microtime(true);

        Log::info('users.reorder.start', [
            'request_id' => $requestId,
            'user_id' => optional($request->user())->id,
            'item_count' => count($request->input('items', [])),
        ]);

        $validated = $request->validate([
            'items' => ['required','array'],
            'items.*.id' => ['required','integer','exists:users,id'],
            'items.*.parent_id' => ['nullable','integer','exists:users,id'],
            'items.*.position' => ['required','integer','min:0'],
        ]);

        Log::info('users.reorder.validated', [
            'request_id' => $requestId,
            'item_count' => count($validated['items'] ?? []),
        ]);

        try {
            $response = DB::transaction(function () use ($validated, $requestId, $startedAt) {
                $rows = collect($validated['items']);

                // Sécurité anti-cycles simple : parent_id != id
                foreach ($rows as $r) {
                    if (!is_null($r['parent_id']) && (int)$r['parent_id'] === (int)$r['id']) {
                        Log::warning('users.reorder.invalid_parent', [
                            'request_id' => $requestId,
                            'id' => (int) $r['id'],
                        ]);
                        abort(422, 'Invalid parent.');
                    }
                }

                // Anti-cycles basique via parcours parent -> racine
                $rows->each(function ($r) use ($rows, $requestId) {
                    $parentId = $r['parent_id'];
                    $visited = [];
                    while ($parentId !== null) {
                        if (in_array($parentId, $visited, true)) {
                            Log::warning('users.reorder.circular_reference', [
                                'request_id' => $requestId,
                                'id' => (int) $r['id'],
                                'parent_id' => (int) $parentId,
                            ]);
                            abort(422, 'Circular parent reference detected.');
                        }
                        $visited[] = $parentId;
                        $parent = $rows->firstWhere('id', $parentId);
                        $parentId = $parent ? $parent['parent_id'] : null;
                        if (count($visited) > 1000) break; // garde-fou
                    }
                });

                if ($this->canUseOptimizedUsersReorder($rows)) {
                    User::rebuildTree($this->buildUsersReorderTree($rows));

                    $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
                    Log::info('users.reorder.done', [
                        'request_id' => $requestId,
                        'mode' => 'optimized',
                        'item_count' => $rows->count(),
                        'duration_ms' => $durationMs,
                    ]);

                    return response()->json([
                        'ok' => true,
                        'mode' => 'optimized',
                    ]);
                }

                Log::warning('users.reorder.fallback', [
                    'request_id' => $requestId,
                    'item_count' => $rows->count(),
                ]);

                $groups = $rows->groupBy(fn($r) => $r['parent_id'] ?? null);

                // Détacher puis reconstruire l'arbre pour éviter toute corruption
                $allIds = $rows->pluck('id')->toArray();
                $allNodes = User::whereIn('id', $allIds)->get();

                foreach ($allNodes as $node) {
                    $node->parent_id = null;
                    $node->save();
                }

                // Rebuild the tree using nested set helpers (same approach as categories)
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

                        // recurse
                        $placeChildren($node->id);
                    }
                };

                // Démarrer par les racines
                $placeChildren(null);

                $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
                Log::info('users.reorder.done', [
                    'request_id' => $requestId,
                    'mode' => 'fallback',
                    'item_count' => $rows->count(),
                    'duration_ms' => $durationMs,
                ]);

                return response()->json([
                    'ok' => true,
                    'mode' => 'fallback',
                ]);
            });

            return $response;
        } catch (\Throwable $e) {
            $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
            Log::error('users.reorder.failed', [
                'request_id' => $requestId,
                'duration_ms' => $durationMs,
                'message' => $e->getMessage(),
                'exception' => get_class($e),
            ]);

            throw $e;
        }
    }

    private function canUseOptimizedUsersReorder(\Illuminate\Support\Collection $rows): bool
    {
        $submittedIds = $rows
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($submittedIds->isEmpty()) {
            return false;
        }

        $dbIds = User::query()
            ->select('id')
            ->orderBy('id')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($submittedIds->count() !== $dbIds->count()) {
            return false;
        }

        return $submittedIds->sort()->values()->all() === $dbIds->all();
    }

    private function buildUsersReorderTree(\Illuminate\Support\Collection $rows, ?int $parentId = null): array
    {
        return $rows
            ->filter(fn (array $row) => ($row['parent_id'] ?? null) === $parentId)
            ->sortBy('position')
            ->values()
            ->map(fn (array $row) => [
                'id' => (int) $row['id'],
                'children' => $this->buildUsersReorderTree($rows, (int) $row['id']),
            ])
            ->all();
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
            'merge' => ['nullable', 'boolean'],
        ]);

        $dbIds = $request->input('db_ids', []);
        $attributes = $request->input('attributes', []);
        $merge = $request->boolean('merge');

        $normalize = function (array $value) use (&$normalize): array {
            foreach ($value as $key => $item) {
                if (is_array($item)) {
                    $value[$key] = $normalize($item);
                }
            }
            ksort($value);
            return $value;
        };

        $current = $user->dbProducts()
            ->get()
            ->mapWithKeys(function ($dbProduct) use ($normalize) {
                $attrs = [];
                $pivot = $dbProduct->pivot;
                if ($pivot && $pivot->attributes) {
                    $decoded = json_decode($pivot->attributes, true);
                    if (is_array($decoded)) {
                        $attrs = $normalize($decoded);
                    }
                }
                return [(int) $dbProduct->id => $attrs];
            })
            ->toArray();

        // On prépare le tableau pour sync : [db_product_id => ['attributes' => ...], ...]
        $syncData = [];
        $next = [];

        if ($merge) {
            $next = $current;
            foreach ($current as $dbId => $attrs) {
                $syncData[$dbId] = [
                    'attributes' => json_encode($attrs),
                ];
            }
        }

        foreach ($dbIds as $dbId) {
            $attr = $attributes[$dbId] ?? [];
            // Si c'est une string JSON (cas rare), on la décode
            if (is_string($attr)) {
                $decoded = json_decode($attr, true);
                $attr = is_array($decoded) ? $decoded : [];
            }
            if (!is_array($attr)) {
                $attr = [];
            }
            $normalizedAttr = $normalize($attr);
            $next[(int) $dbId] = $normalizedAttr;
            $syncData[$dbId] = [
                'attributes' => json_encode($normalizedAttr),
            ];
        }

        $user->dbProducts()->sync($syncData);

        $currentIds = array_keys($current);
        $nextIds = array_keys($next);
        sort($currentIds);
        sort($nextIds);
        $hasChanges = $currentIds !== $nextIds;

        if (!$hasChanges) {
            foreach ($nextIds as $dbId) {
                $currentJson = json_encode($current[$dbId] ?? []);
                $nextJson = json_encode($next[$dbId] ?? []);
                if ($currentJson !== $nextJson) {
                    $hasChanges = true;
                    break;
                }
            }
        }

        if ($hasChanges) {
            Cache::put('cart:refresh:' . $user->id, now()->getTimestamp(), now()->addHour());
        }

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
        $eligibleUsers = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['commercial', 'admin', 'dev']))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);
        $carriers = \App\Models\Carrier::query()
            ->with(['zones:id,carrier_id,name'])
            ->orderBy('name')
            ->get(['id', 'name', 'country']);

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
            'eligibleUsers' => $eligibleUsers,
            'carriers' => $carriers,
            'selectedDbId' => $selected,
            'dbUserAttributes' => $dbUserAttributes,
        ]);
    }

    /**
     * Import users process - handle initial upload.
     */
    public function process(Request $request, UserImportService $importService)
    {
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }
        
        

        $data = $request->validate([
            'id' => 'required|string',
            'strategy' => ['nullable', 'in:basique,old_DB'],
        ]);
        $id = $data['id'];
        $strategy = $data['strategy'] ?? null;

        

        $state = Cache::get("import:$id", []);
        Log::info("ok " . json_encode($state));
        if (!$state || empty($state['path'])) {
            return response()->json(['message' => 'Import inconnu'], 404);
        }

        // Log::info("ok " . $state['path']);
        $path = $state['path'];
        $fullPath = Storage::path($path);

        if (!is_string($fullPath) || !is_file($fullPath)) {
            return response()->json(['message' => "Impossible d'accéder au fichier importé"], 400);
        }

        $relativePath = $path;

        $this->updateImportState($id, [
            'status' => 'processing',
            'processed' => 0,
            'total' => 0,
            'errors' => 0,
            'progress' => 0,
            'current' => null,
            'report' => null,
            'path' => $relativePath,
            'next_offset' => 0,
            'has_more' => true,
            'strategy' => $strategy,
        ]);

        // Log::info("User import started synchronously for ID: $id");

        // Découper uniquement (le service ne traite plus le premier chunk synchronement)
        $importService->run($id, $fullPath, $relativePath);

        // Vérifier la présence du premier chunk et ajuster l'état initial
        $tmpDir = Storage::path('imports/tmp/' . $id);
        $firstChunk = $tmpDir . DIRECTORY_SEPARATOR . 'data_0.csv';
        $hasFirst = is_file($firstChunk);
        $this->updateImportState($id, [
            'next_offset' => 0,
            'has_more' => $hasFirst,
        ]);

        // on renvoie l'état courant du cache
        $final = Cache::get("import:$id") ?? [
            'status' => 'processing',
            'processed' => 0,
            'total' => 0,
            'errors' => 0,
            'progress' => 0,
        ];

        return response()->json($final);
    }

    /**
     * Import users process chunk - continue processing.
     */
    public function processChunk(Request $request, UserImportService $importService)
    {
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $data = $request->validate([
            'id' => 'required|string',
        ]);

        $id = $data['id'];

        $state = Cache::get("import:$id");
        if (!$state || empty($state['path'])) {
            return response()->json(['message' => 'Import inconnu'], 404);
        }

        $path = $state['path'];
        $fullPath = Storage::path($path);

        if (!is_string($fullPath) || !is_file($fullPath)) {
            return response()->json(['message' => "Impossible d'accéder au fichier importé"], 400);
        }

        $relativePath = $path;
        $chunkIndex = isset($state['next_offset']) ? (int) $state['next_offset'] : 0;

        Log::info("User import chunk requested for ID: $id at chunk index $chunkIndex");

        $importService->runChunk($id, $relativePath, $chunkIndex);

        $final = Cache::get("import:$id") ?? [
            'status' => 'done',
            'processed' => 0,
            'total' => 0,
            'errors' => 0,
            'progress' => 100,
        ];

        return response()->json($final);
    }

    /**
     * Get import progress.
     */
    public function progress(string $id)
    {
        $progress = Cache::get("import:$id");

        if (!$progress) {
            return response()->json(['status' => 'waiting', 'progress' => 0]);
        }

        return response()->json([
            'status' => $progress['status'] ?? 'processing',
            'processed' => $progress['processed'] ?? 0,
            'total' => $progress['total'] ?? 0,
            'errors' => $progress['errors'] ?? 0,
            'current' => $progress['current'] ?? null,
            'progress' => $progress['progress'] ?? null,
            'report' => $progress['report'] ?? null,
            'next_offset' => $progress['next_offset'] ?? null,
            'has_more' => $progress['has_more'] ?? false,
        ]);
    }

    /**
     * Cancel import.
     */
    public function cancel(Request $request)
    {
        // Vérifier que l'utilisateur est admin
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $data = $request->validate([
            'id' => ['required', 'string'],
        ]);
        $id = $data['id'];
        Cache::put("import:$id:cancel", true, now()->addHour());
        $state = Cache::get("import:$id", []);
        Cache::put("import:$id", array_merge($state, [ 'status' => 'cancelling' ]), now()->addHour());
        return response()->json(['status' => 'cancelling']);
    }

    /**
     * Download import report.
     */
    public function report(string $id)
    {
        $reportPath = 'imports/reports/' . $id . '.csv';
        if (!Storage::exists($reportPath)) {
            return response()->json(['message' => 'Rapport introuvable'], 404);
        }

        $full = Storage::path($reportPath);
        $filename = 'users_import_report_' . $id . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($full) {
            $h = fopen($full, 'r');
            while (!feof($h)) {
                echo fread($h, 8192);
            }
            fclose($h);
        };

        return new StreamedResponse($callback, 200, $headers);
    }

    /**
     * Update import state in cache (helper).
     */
    private function updateImportState(string $id, array $state): void
    {
        $current = Cache::get("import:$id", []);
        $merged = array_merge($current, $state);
        Cache::put("import:$id", $merged, now()->addHour());
    }

    /**
     * Génère les propositions de recherche triées selon la logique.
     */
    private function getSearchPropositions($query, ?string $search)
    {
        if (empty($search)) {
            return [];
        }
        
        $lowerSearch = mb_strtolower($search);

        // Récupération des noms distincts - réinitialiser le ORDER BY pour éviter les conflits
        $clonedQuery = clone $query;
        $clonedQuery->getQuery()->orders = null; // Supprime les ORDER BY
        
        $propositions = $clonedQuery
            ->selectRaw('MIN(id) as id, name, MIN(created_at) as created_at')
            ->groupBy('name')
            ->pluck('name');

        // --- 🧹 Nettoyage et déduplication ---
        $clean = function (string $str): string {
            $str = mb_strtolower($str);
            // garde uniquement lettres, espaces et tirets (supprime chiffres, /, etc.)
            $str = preg_replace('/[^\p{L}\s-]/u', ' ', $str);
            // espaces multiples → un seul
            $str = trim(preg_replace('/\s+/', ' ', $str));
            return $str;
        };

        // Applique le nettoyage
        $cleaned = $propositions
            ->map(fn($name) => $clean($name))
            ->filter(fn($name) => !empty($name))
            ->unique()
            ->values();

        // --- 🔢 Tri selon priorités ---
        $items = $cleaned->all();

        usort($items, function ($a, $b) use ($lowerSearch) {
            // Priorité :
            // 1 = mot unique (sans espace ni tiret) qui commence par le terme
            // 2 = commence par le terme
            // 3 = contient le terme ailleurs
            // 4 = autres
            $pa = (
                !preg_match('/[-\s]/', $a) && str_starts_with($a, $lowerSearch)
            ) ? 1 : (
                str_starts_with($a, $lowerSearch) ? 2 : (
                str_contains($a, $lowerSearch) ? 3 : 4
            ));

            $pb = (
                !preg_match('/[-\s]/', $b) && str_starts_with($b, $lowerSearch)
            ) ? 1 : (
                str_starts_with($b, $lowerSearch) ? 2 : (
                str_contains($b, $lowerSearch) ? 3 : 4
            ));

            if ($pa !== $pb) return $pa <=> $pb;

            // Second critère : longueur
            $la = mb_strlen($a);
            $lb = mb_strlen($b);
            if ($la !== $lb) return $la <=> $lb;

            // Troisième : ordre alphabétique
            return strnatcmp($a, $b);
        });

        // Prend les 7 premiers
        return $items;
    }
}
