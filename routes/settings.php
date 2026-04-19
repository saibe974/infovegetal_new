<?php

use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\UserAdditionalInfoController;
use App\Http\Controllers\Settings\TwoFactorAuthenticationController;
use App\Models\User;
use App\Services\UserManagementAuthorizationService;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    // Redirect legacy settings root to the authenticated user's profile path
    Route::get('settings', function (Request $request) {
        return redirect()->route('profile.edit');
    });

    Route::get('settings/profile', [ProfileController::class, 'edit'])
        ->name('profile.edit');

    Route::patch('settings/profile', [ProfileController::class, 'update'])
        ->name('profile.update');

    Route::delete('settings/profile', [ProfileController::class, 'destroy'])
        ->name('profile.destroy');

    Route::get('settings/password', function (Request $request, PasswordController $controller) {
        return $controller->edit($request);
    })->name('settings.password.edit');

    Route::put('settings/password', function (Request $request, PasswordController $controller) {
        return $controller->update($request);
    })->middleware('throttle:6,1')
      ->name('settings.password.update');

    Route::get('settings/appearance', function (Request $request) {
        $user = $request->user();
        return Inertia::render('settings/appearance', [
            'editingUser' => $user?->load(['roles', 'permissions']),
        ]);
    })->name('settings.appearance.edit');

    Route::get('settings/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('settings.two-factor.show');

    Route::get('settings/additional-info', [UserAdditionalInfoController::class, 'edit'])
        ->name('settings.additional.edit');

    Route::patch('settings/additional-info', [UserAdditionalInfoController::class, 'update'])
        ->name('settings.additional.update');

    Route::post('settings/additional-info/meta', [UserAdditionalInfoController::class, 'storeMeta'])
        ->name('settings.additional.meta.store');

    Route::put('settings/additional-info/meta/{meta}', [UserAdditionalInfoController::class, 'updateMeta'])
        ->name('settings.additional.meta.update');

    Route::delete('settings/additional-info/meta/{meta}', [UserAdditionalInfoController::class, 'destroyMeta'])
        ->name('settings.additional.meta.destroy');


    Route::get('admin/users/{user}/password', function (Request $request, PasswordController $controller) {
        return $controller->edit($request);
    })->name('password.edit');

    Route::put('admin/users/{user}/password', function (Request $request, PasswordController $controller) {
        return $controller->update($request);
    })->middleware('throttle:6,1')
      ->name('password.update');

    Route::get('admin/users/{user}/appearance', function (Request $request) {
        $user = User::findOrFail($request->route('user'));
        $authorization = app(UserManagementAuthorizationService::class);

        return Inertia::render('settings/appearance', [
            'editingUser' => $user->load(['roles', 'permissions']),
            'userAbilities' => [
                'manage_db' => $authorization->canManageClientDatabase($request->user(), $user),
            ],
        ]);
    })->name('appearance.edit');

    Route::get('admin/users/{user}/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('two-factor.show');

    Route::get('admin/users/{user}/additional-info', [UserAdditionalInfoController::class, 'edit'])
        ->name('additional.edit');

    Route::patch('admin/users/{user}/additional-info', [UserAdditionalInfoController::class, 'update'])
        ->name('additional.update');

    Route::post('admin/users/{user}/additional-info/meta', [UserAdditionalInfoController::class, 'storeMeta'])
        ->name('additional.meta.store');

    Route::put('admin/users/{user}/additional-info/meta/{meta}', [UserAdditionalInfoController::class, 'updateMeta'])
        ->name('additional.meta.update');

    Route::delete('admin/users/{user}/additional-info/meta/{meta}', [UserAdditionalInfoController::class, 'destroyMeta'])
        ->name('additional.meta.destroy');
   
});
