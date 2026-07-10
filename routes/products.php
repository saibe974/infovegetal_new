<?php

use App\Http\Controllers\Api\DbProductsController as ApiDbProductsController;
use App\Http\Controllers\CategoryProductsController;
use App\Http\Controllers\DbProductsController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\TagController;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Routes publiques de consultation des produits
Route::prefix('products')->name('products.')->group(function () {
    Route::get('/', [ProductController::class, 'index'])->name('index');
    Route::get('/{product}', [ProductController::class, 'show'])->name('show');
});

// API publique pour récupérer un produit (pour l'ajout au panier après login)
Route::get('/api/products/{product}', function (Product $product) {
    return new ProductResource($product->load(['category', 'tags', 'dbProduct']));
});

// API authentifiée pour le panier (prix calculés selon le user courant)
Route::middleware(['auth'])->get('/api/auth/products/{product}', function (Request $request, Product $product) {
    $user = $request->user();
    $dbProductId = (int) ($product->db_products_id ?? 0);

    if ($user && $dbProductId > 0) {
        $dbProduct = $user->dbProducts()->where('db_products.id', $dbProductId)->first();
        $pivotAttributes = $dbProduct?->pivot?->attributes;

        if ($pivotAttributes) {
            $decoded = is_string($pivotAttributes)
                ? json_decode($pivotAttributes, true)
                : $pivotAttributes;
            if (is_array($decoded)) {
                $product->setAttribute('db_user_attributes', $decoded);
            }
        }
    }

    return new ProductResource($product->load(['category', 'tags', 'dbProduct']));
});

// Route pour sauvegarder le panier en session (authentifiée)
Route::post('/products/save-cart-filter', [ProductController::class, 'saveCartToSession'])
    ->middleware(['auth'])
    ->name('products.save-cart-filter');

Route::middleware(['auth', 'verified'])->group(function () {
    // API routes accessibles depuis l'admin (JSON)
    Route::prefix('api')
        ->name('api.')
        ->middleware(['role_or_permission_or_impersonator:admin|users.db_products.manage.all|users.db_products.manage.his'])
        ->group(function () {
            Route::get('/db-products', [ApiDbProductsController::class, 'index'])
                ->name('db-products.index');
        });

    // Routes admin des produits - nécessite le rôle admin
    Route::middleware(['role_or_impersonator:admin'])->prefix('admin/products')->name('products.admin.')->group(function () {
        Route::get('/', [ProductController::class, 'index'])->name('index');
        Route::get('/create', [ProductController::class, 'create'])->name('create');
        Route::post('/', [ProductController::class, 'store'])->name('store');
        Route::get('/{product}/edit', [ProductController::class, 'edit'])->name('edit');
        Route::put('/{product}', [ProductController::class, 'update'])->name('update');
        Route::delete('/{product}', [ProductController::class, 'destroy'])->name('destroy');

        // CSV import/export endpoints
        Route::get('/export', [ProductController::class, 'export'])->name('export');
    });

    // Product import endpoints: admin ou permissions users.db_products.manage.*
    Route::prefix('admin/products/import')->name('products.admin.import.')->middleware([
        'role_or_permission_or_impersonator:admin|users.db_products.manage.all|users.db_products.manage.his',
    ])->group(function () {
        Route::post('/process', [ProductController::class, 'importProcess'])->name('process');
        Route::post('/process-chunk', [ProductController::class, 'importProcessChunk'])->name('process_chunk');
        Route::post('/cancel', [ProductController::class, 'importCancel'])->name('cancel');
        Route::get('/progress/{id}', [ProductController::class, 'importProgress'])->name('progress');
        Route::get('/report/{id}', [ProductController::class, 'importReport'])->name('report');
    });

    // Catégories de produits
    Route::post('category-products/reorder', [CategoryProductsController::class, 'reorder'])->name('category-products.reorder')->middleware(['role_or_permission_or_impersonator:admin|products.categories.manage|manage categories']);
    Route::get('category-products/children', [CategoryProductsController::class, 'children'])->name('category-products.children')->middleware(['role_or_permission_or_impersonator:admin|products.categories.manage|manage categories']);
    Route::post('products/categories/move', [CategoryProductsController::class, 'move'])
        ->name('products.categories.move')
        ->middleware(['role_or_permission_or_impersonator:admin|products.categories.manage|manage categories']);
    Route::resource('category-products', CategoryProductsController::class)
        ->middleware(['role_or_permission_or_impersonator:admin|products.categories.manage|manage categories']);

    // DbProducts
    Route::post('db-products/analyze-sample', [DbProductsController::class, 'analyzeSample'])
        ->name('db-products.analyze-sample')
        ->middleware(['role_or_permission_or_impersonator:admin|users.db_products.manage.all|users.db_products.manage.his']);
    Route::put('db-products/{db_product}/import-config', [DbProductsController::class, 'updateImportConfig'])
        ->name('db-products.import-config')
        ->middleware(['role_or_permission_or_impersonator:admin|users.db_products.manage.all|users.db_products.manage.his']);
    Route::get('db-products', [DbProductsController::class, 'index'])
        ->name('db-products.index')
        ->middleware(['role_or_permission_or_impersonator:admin|users.db_products.manage.all|users.db_products.manage.his']);
    Route::get('db-products/{db_product}/edit', [DbProductsController::class, 'edit'])
        ->name('db-products.edit')
        ->middleware(['role_or_permission_or_impersonator:admin|users.db_products.manage.all|users.db_products.manage.his']);
    Route::get('db-products/{db_product}/billing', [DbProductsController::class, 'billing'])
        ->name('db-products.billing')
        ->middleware(['role_or_permission_or_impersonator:admin|users.db_products.manage.all|users.db_products.manage.his']);
    Route::put('db-products/{db_product}', [DbProductsController::class, 'update'])
        ->name('db-products.update')
        ->middleware(['role_or_permission_or_impersonator:admin|users.db_products.manage.all|users.db_products.manage.his']);
    Route::put('db-products/{db_product}/billing', [DbProductsController::class, 'updateBilling'])
        ->name('db-products.update-billing')
        ->middleware(['role_or_permission_or_impersonator:admin|users.db_products.manage.all|users.db_products.manage.his']);
    Route::resource('db-products', DbProductsController::class)
        ->except(['index', 'edit', 'update'])
        ->middleware(['role_or_impersonator:admin']);

    // Tags
    Route::resource('tags-products', TagController::class)->middleware(['role_or_impersonator:admin']);
});
