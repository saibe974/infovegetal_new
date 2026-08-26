<?php

use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\UserAdditionalInfoController;
use App\Http\Controllers\Settings\TwoFactorAuthenticationController;
use App\Http\Controllers\Settings\AppearanceController;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

Route::middleware('auth')->group(function () {
    // Redirect legacy settings root to the authenticated user's profile path
    Route::get('settings', function (Request $request) {
        return redirect()->route('profile.edit');
    });

    Route::get('settings/profile', [ProfileController::class, 'edit'])
        ->name('profile.edit');

    Route::patch('settings/profile', [ProfileController::class, 'update'])
        ->name('profile.update');

    Route::get('settings/permissions', [ProfileController::class, 'editPermissions'])
        ->name('settings.permissions.edit');

    Route::patch('settings/permissions', [ProfileController::class, 'updatePermissions'])
        ->name('settings.permissions.update');

    Route::delete('settings/profile', [ProfileController::class, 'destroy'])
        ->name('profile.destroy');

    Route::get('settings/password', function (Request $request, PasswordController $controller) {
        return $controller->edit($request);
    })->name('password.edit');

        Route::put('settings/password', function (Request $request, PasswordController $controller) {
        return $controller->update($request);
    })->middleware('throttle:6,1')
            ->name('password.update');

    Route::get('settings/contracts', [ProfileController::class, 'editContracts'])
        ->name('settings.contracts.edit');

    Route::get('settings/appearance', [AppearanceController::class, 'edit'])
        ->name('settings.appearance.edit');

    Route::put('settings/appearance', [AppearanceController::class, 'update'])
        ->name('settings.appearance.update');

    Route::get('settings/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('two-factor.show');

    Route::post('settings/additional-info/meta', [UserAdditionalInfoController::class, 'storeMeta'])
        ->name('settings.additional.meta.store');

    Route::put('settings/additional-info/meta/{meta}', [UserAdditionalInfoController::class, 'updateMeta'])
        ->name('settings.additional.meta.update');

    Route::delete('settings/additional-info/meta/{meta}', [UserAdditionalInfoController::class, 'destroyMeta'])
        ->name('settings.additional.meta.destroy');


    Route::get('admin/users/{user}/password', function (Request $request, PasswordController $controller) {
        return $controller->edit($request);
    })->name('admin.password.edit');

    Route::get('admin/users/{user}/permissions', [ProfileController::class, 'editPermissions'])
        ->name('permissions.edit');

    Route::get('admin/users/{user}/contracts', [ProfileController::class, 'editContracts'])
        ->whereNumber('user')
        ->name('admin.contracts.edit');

    Route::patch('admin/users/{user}/permissions', [ProfileController::class, 'updatePermissions'])
        ->name('permissions.update');

        Route::put('admin/users/{user}/password', function (Request $request, PasswordController $controller) {
        return $controller->update($request);
    })->middleware('throttle:6,1')
            ->name('admin.password.update');

    Route::get('admin/users/{user}/appearance', [AppearanceController::class, 'edit'])
        ->name('appearance.edit');

    Route::put('admin/users/{user}/appearance', [AppearanceController::class, 'update'])
        ->name('appearance.update');

    Route::get('admin/users/{user}/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('admin.two-factor.show');

    Route::post('admin/users/{user}/additional-info/meta', [UserAdditionalInfoController::class, 'storeMeta'])
        ->name('additional.meta.store');

    Route::put('admin/users/{user}/additional-info/meta/{meta}', [UserAdditionalInfoController::class, 'updateMeta'])
        ->name('additional.meta.update');

    Route::delete('admin/users/{user}/additional-info/meta/{meta}', [UserAdditionalInfoController::class, 'destroyMeta'])
        ->name('additional.meta.destroy');
   
});
