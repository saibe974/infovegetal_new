<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Auth\Access\Gate;
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

        //  return Inertia::render('products/index', [
        //     'q' => $search,
        //     'collection' => Inertia::scroll(fn() => ProductResource::collection(
        //         $query->paginate(12)
        //     )),
        //     'searchPropositions' => Inertia::optional(fn() => $this->getSearchPropositions($query, $search)),
        // ]);
    }

    public function edit(User $user)
    {
        // $user->load(['tags']);
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
     * Export users as CSV.
     */
    public function export(Request $request)
    {
        // FacadesGate::authorize('manage-users');
        $filename = 'users_export_' . date('Ymd_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () {
            $handle = fopen('php://output', 'w');
            // header (séparateur ';')
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
