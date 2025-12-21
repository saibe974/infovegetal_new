<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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

        // Only the user themself or an admin can view/edit
        if ($request->user()->id !== $target->id && !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $target instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            'editingUser' => $target->loadMissing(['roles', 'permissions']),
            'allRoles' => \Spatie\Permission\Models\Role::with('permissions:id,name')->get(['id', 'name']),
            'allPermissions' => \Spatie\Permission\Models\Permission::all(['id', 'name']),
        ]);
    }

    /**
     * Update the user's profile settings.
     */
    public function update(ProfileUpdateRequest $request, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();

        // Authorization: only self or admin
        if ($request->user()->id !== $target->id && !$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $target->fill($request->validated());

        if ($target->isDirty('email')) {
            $target->email_verified_at = null;
        }

        $target->save();

        // Redirect back to the same edit page (preserve route name)
        return to_route('profile.edit', ['user' => $target->id]);
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

        // Otherwise only admin can delete other users
        if (!$request->user()->hasRole('admin')) {
            abort(403, 'Unauthorized');
        }

        $target->delete();
        return back()->with('success', 'User deleted');
    }
}
