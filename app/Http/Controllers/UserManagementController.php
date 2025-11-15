<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

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

         return Inertia::render('products/index', [
            'q' => $search,
            'collection' => Inertia::scroll(fn() => ProductResource::collection(
                $query->paginate(12)
            )),
            'searchPropositions' => Inertia::optional(fn() => $this->getSearchPropositions($query, $search)),
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
}
