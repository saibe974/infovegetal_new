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

    // New profile routes under admin/users/{user}/profile — controller handles authorization (self or admin)
    Route::get('admin/users/{user}/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('admin/users/{user}/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('admin/users/{user}/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');


    Route::get('admin/users/{user}/password', function (Request $request, PasswordController $controller) {
        return $controller->edit($request);
    })->name('password.edit');

    Route::put('admin/users/{user}/password', function (Request $request, PasswordController $controller) {
        return $controller->update($request);
    })->middleware('throttle:6,1')
      ->name('password.update');

    Route::get('admin/users/{user}/appearance', function (Request $request) {
        return Inertia::render('settings/appearance');
    })->name('appearance.edit');

    Route::get('admin/users/{user}/two-factor', function (Request $request, TwoFactorAuthenticationController $controller) {
        return $controller->show($request);
    })->name('two-factor.show');
   
});
