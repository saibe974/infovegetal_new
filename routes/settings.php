<?php

use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\TwoFactorAuthenticationController;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    // Redirect legacy settings root to the authenticated user's profile path
    Route::get('settings', function (Request $request) {
        return redirect()->route('profile.edit', ['user' => $request->user()->id]);
    });

    // ...existing code...


    Route::get('admin/users/{user}/password', function (Request $request, PasswordController $controller) {
        return $controller->edit($request);
    })->name('password.edit');

    Route::put('admin/users/{user}/password', function (Request $request, PasswordController $controller) {
        return $controller->update($request);
    })->middleware('throttle:6,1')
      ->name('password.update');

    Route::get('admin/users/{user}/appearance', function (Request $request) {
        $user = \App\Models\User::findOrFail($request->route('user'));
        return Inertia::render('settings/appearance', [
            'editingUser' => $user->load(['roles', 'permissions']),
        ]);
    })->name('appearance.edit');

    Route::get('admin/users/{user}/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('two-factor.show');
   
});
