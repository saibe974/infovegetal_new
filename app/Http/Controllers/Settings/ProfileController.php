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

class ProfileController extends Controller
{
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
            'allRoles' => \Spatie\Permission\Models\Role::with('permissions:id,name')->get(['id', 'name']),
            'allPermissions' => \Spatie\Permission\Models\Permission::all(['id', 'name']),
            'userAbilities' => [
                'update' => $request->user()->can('update', $target),
                'assign_roles' => $request->user()->can('assignRoles', $target),
                'assign_permissions' => $request->user()->can('assignPermissions', $target),
                'move' => $request->user()->can('move', $target),
                'delete' => $request->user()->can('delete', $target),
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
