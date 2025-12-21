<?php

use App\Http\Controllers\homeController;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Product;
use App\Http\Resources\ProductResource;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\SearchController;

Route::get('/', [homeController::class, 'index'])->name('home');
Route::get('/documentation', [homeController::class, 'documentation'])->name('documentation');
Route::get('/legals/legal-notices', [homeController::class, 'legalNotices'])->name('legal.notices');
Route::get('/legals/sale-conditions', [homeController::class, 'saleConditions'])->name('legal.sale_conditions');
Route::get('/legals/our-policy', [homeController::class, 'ourPolicy'])->name('legal.our_policy');
Route::get('/contact', [ContactController::class, 'index'])->name('contact');

// Routes publiques de consultation des produits
Route::prefix('products')->name('products.')->group(function () {
    Route::get('/', [\App\Http\Controllers\ProductController::class, 'index'])->name('index');
    Route::get('/{product}', [\App\Http\Controllers\ProductController::class, 'show'])->name('show');
});



Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // Route d'upload générique (gère POST pour l'envoi, PATCH pour les chunks, DELETE pour revert)
    Route::match(['post', 'patch', 'delete'], 'upload', \App\Http\Controllers\UploadController::class)->name('upload');

    // API routes accessibles depuis l'admin (JSON)
    Route::prefix('api')
        ->name('api.')
        ->middleware(['role:admin'])
        ->group(function () {
            Route::get('/db-products', [\App\Http\Controllers\Api\DbProductsController::class, 'index'])
                ->name('db-products.index');
        });

    // Routes admin des produits - nécessite le rôle admin
    Route::middleware(['role:admin'])->prefix('admin/products')->name('products.admin.')->group(function () {
        Route::get('/', [\App\Http\Controllers\ProductController::class, 'index'])->name('index');
        Route::get('/create', [\App\Http\Controllers\ProductController::class, 'create'])->name('create');
        Route::post('/', [\App\Http\Controllers\ProductController::class, 'store'])->name('store');
        Route::get('/{product}/edit', [\App\Http\Controllers\ProductController::class, 'edit'])->name('edit');
        Route::put('/{product}', [\App\Http\Controllers\ProductController::class, 'update'])->name('update');
        Route::delete('/{product}', [\App\Http\Controllers\ProductController::class, 'destroy'])->name('destroy');

        // CSV import/export endpoints
        Route::post('/import/process', [\App\Http\Controllers\ProductController::class, 'importProcess'])->name('import.process');
        Route::post('/import/process-chunk', [\App\Http\Controllers\ProductController::class, 'importProcessChunk'])->name('import.process_chunk');
        Route::post('/import/cancel', [\App\Http\Controllers\ProductController::class, 'importCancel'])->name('import.cancel');
        Route::get('/import/progress/{id}', [\App\Http\Controllers\ProductController::class, 'importProgress'])->name('import.progress');
        Route::get('/import/report/{id}', [\App\Http\Controllers\ProductController::class, 'importReport'])->name('import.report');
        Route::get('/export', [\App\Http\Controllers\ProductController::class, 'export'])->name('export');
    });

    Route::post('category-products/reorder', [\App\Http\Controllers\CategoryProductsController::class, 'reorder'])->name('category-products.reorder')->middleware(['role:admin']);
    Route::get('category-products/children', [\App\Http\Controllers\CategoryProductsController::class, 'children'])->name('category-products.children')->middleware(['role:admin']);
    // Move endpoint pour dnd-kit (déplacement granulaire)
    Route::post('products/categories/move', [\App\Http\Controllers\CategoryProductsController::class, 'move'])
        ->name('products.categories.move')
        ->middleware(['role:admin']);
    Route::resource('category-products', \App\Http\Controllers\CategoryProductsController::class)->middleware(['role:admin']);
    Route::resource('db-products', \App\Http\Controllers\DbProductsController::class)->middleware(['role:admin']);
    Route::resource('tags-products', \App\Http\Controllers\TagController::class)->middleware(['role:admin']);
});

// Gestion des utilisateurs (admin uniquement)
Route::middleware(['role:admin'])->group(function () {
    Route::get('users', [UserManagementController::class, 'index'])->name('users.index');
    Route::get('admin/users/{user}/edit', [UserManagementController::class, 'edit'])->name('users.edit');
    Route::put('admin/users/{user}', [UserManagementController::class, 'update'])->name('users.update');
    Route::get('admin/users/{user}/db', [UserManagementController::class, 'db'])->name('users.db');
    Route::post('users/{user}/role', [UserManagementController::class, 'updateRole'])->name('users.updateRole');
    Route::get('admin/users/export', [UserManagementController::class, 'export'])->name('users.export');
    Route::post('admin/users/reorder', [UserManagementController::class, 'reorder'])->name('users.reorder');
    Route::post('admin/users/{user}/db', [UserManagementController::class, 'editDb'])->name('users.editDb');
    
    // Route d'impersonation - take (nécessite admin)
    Route::get('/impersonate/take/{id}/{guardName?}',
        '\Lab404\Impersonate\Controllers\ImpersonateController@take')->name('impersonate');
});

// Route de leave - sans vérification de rôle (le contrôleur fait sa propre vérification)
Route::get('/impersonate/leave',
    '\Lab404\Impersonate\Controllers\ImpersonateController@leave')->name('impersonate.leave');


Route::get('/csrf-refresh', function () {
    return response()->noContent();
});

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';

// Endpoint JSON public pour les propositions de recherche
Route::get('/search-propositions', [SearchController::class, 'propositions'])->name('search.propositions');
