<?php

use App\Http\Controllers\ImpersonationController;
use App\Http\Controllers\RolePermissionManagementController;
use App\Http\Controllers\UserManagementController;
use Illuminate\Support\Facades\Route;

// Gestion des utilisateurs basée sur policy: rôles globaux + permission manage users + hiérarchie
Route::middleware(['auth'])->group(function () {
    Route::get('users', [UserManagementController::class, 'index'])->name('users.index');
    Route::get('admin/users/tree-children', [UserManagementController::class, 'treeChildren'])->name('users.tree-children');
    Route::get('admin/users/tree-search', [UserManagementController::class, 'treeSearch'])->name('users.tree-search');
    Route::get('admin/users/create', [UserManagementController::class, 'create'])->name('users.create');
    Route::post('admin/users', [UserManagementController::class, 'store'])->name('users.store');
    Route::post('admin/users/reorder', [UserManagementController::class, 'reorder'])->name('users.reorder');
    Route::get('admin/users/{user}', [UserManagementController::class, 'show'])->whereNumber('user')->name('users.show');
    Route::get('admin/users/{user}/edit', [UserManagementController::class, 'edit'])->whereNumber('user')->name('users.edit');
    Route::put('admin/users/{user}', [UserManagementController::class, 'update'])->whereNumber('user')->name('users.update');
    Route::delete('admin/users/{user}', [UserManagementController::class, 'destroy'])->whereNumber('user')->name('users.destroy');
    Route::post('admin/users/{user}/role', [UserManagementController::class, 'updateRole'])->whereNumber('user')->name('users.updateRole');
    Route::get('admin/users/{user}/db', [UserManagementController::class, 'db'])->whereNumber('user')->name('users.db');
    Route::post('admin/users/{user}/db', [UserManagementController::class, 'editDb'])->whereNumber('user')->name('users.editDb');
});

// Gestion des utilisateurs réservée aux admins
Route::middleware(['role_or_impersonator:admin'])->group(function () {
    Route::get('admin/users/export', [UserManagementController::class, 'export'])->name('users.export');
    Route::get('admin/users/roles-permissions', [RolePermissionManagementController::class, 'index'])->name('users.roles_permissions.index');
    Route::post('admin/users/roles-permissions/roles', [RolePermissionManagementController::class, 'storeRole'])->name('users.roles_permissions.roles.store');
    Route::get('admin/users/roles-permissions/roles/{role}', [RolePermissionManagementController::class, 'redirectRoleToIndex'])->whereNumber('role')->name('users.roles_permissions.roles.redirect');
    Route::put('admin/users/roles-permissions/roles/{role}', [RolePermissionManagementController::class, 'updateRolePermissions'])->whereNumber('role')->name('users.roles_permissions.roles.update');
    Route::delete('admin/users/roles-permissions/roles/{role}', [RolePermissionManagementController::class, 'destroyRole'])->whereNumber('role')->name('users.roles_permissions.roles.destroy');
    Route::post('admin/users/roles-permissions/permissions', [RolePermissionManagementController::class, 'storePermission'])->name('users.roles_permissions.permissions.store');
    Route::delete('admin/users/roles-permissions/permissions/{permission}', [RolePermissionManagementController::class, 'destroyPermission'])->whereNumber('permission')->name('users.roles_permissions.permissions.destroy');

    // CSV import/export endpoints for users
    Route::post('admin/users/import/process', [UserManagementController::class, 'process'])->name('users.import.process');
    Route::post('admin/users/import/process-chunk', [UserManagementController::class, 'processChunk'])->name('users.import.process_chunk');
    Route::post('admin/users/import/cancel', [UserManagementController::class, 'cancel'])->name('users.import.cancel');
    Route::get('admin/users/import/progress/{id}', [UserManagementController::class, 'progress'])->name('users.import.progress');
    Route::get('admin/users/import/report/{id}', [UserManagementController::class, 'report'])->name('users.import.report');
});

// Impersonation
Route::middleware(['auth'])->group(function () {
    Route::get('/impersonate/take/{id}/{guardName?}', [ImpersonationController::class, 'take'])
        ->whereNumber('id')
        ->name('impersonate');

    Route::get('/impersonate/leave', [ImpersonationController::class, 'leave'])
        ->name('impersonate.leave');

    Route::post('/impersonate/mode', [ImpersonationController::class, 'setMode'])
        ->name('impersonate.mode');
});
