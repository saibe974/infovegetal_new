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
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function edit(User $user)
    {
        return Inertia::render('users/form', [
            'user' => $user,
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
}
