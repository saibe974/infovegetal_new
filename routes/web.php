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
use App\Http\Controllers\CarrierController;
use App\Http\Controllers\MediaController;

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

// API publique pour récupérer un produit (pour l'ajout au panier après login)
Route::get('/api/products/{product}', function (Product $product) {
    return new ProductResource($product->load(['category', 'tags', 'dbProduct']));
});

// API authentifiee pour le panier (prix calcules selon le user courant)
Route::middleware(['auth'])->get('/api/auth/products/{product}', function (Request $request, Product $product) {
    $user = $request->user();
    $dbProductId = (int) ($product->db_products_id ?? 0);

    if ($user && $dbProductId > 0) {
        $dbProduct = $user->dbProducts()->where('db_product_id', $dbProductId)->first();
        $pivotAttributes = $dbProduct?->pivot?->attributes;

        if ($pivotAttributes) {
            $decoded = is_string($pivotAttributes)
                ? json_decode($pivotAttributes, true)
                : $pivotAttributes;
            if (is_array($decoded)) {
                $product->setAttribute('db_user_attributes', $decoded);
            }
        }

        if ($product->getAttribute('db_user_attributes')) {
            $prices = app(\App\Services\PriceCalculatorService::class)
                ->calculatePrice($product, $user, $dbProductId);
            $product->price = $prices[0] ?? $product->price;
            $product->price_floor = $prices[1] ?? $product->price_floor;
            $product->price_roll = $prices[2] ?? $product->price_roll;
            $product->price_promo = $prices[3] ?? $product->price_promo;
        }
    }

    return new ProductResource($product->load(['category', 'tags', 'dbProduct']));
});

// Route pour sauvegarder le panier en session (authentifiée)
Route::post('/products/save-cart-filter', [\App\Http\Controllers\ProductController::class, 'saveCartToSession'])
    ->middleware(['auth'])
    ->name('products.save-cart-filter');



Route::middleware(['auth', 'verified'])->group(function () {
        // Routes du panier (cart)
        Route::prefix('cart')->name('cart.')->group(function () {
            Route::get('/', [\App\Http\Controllers\CartController::class, 'index'])->name('index');
            Route::get('/checkout', [\App\Http\Controllers\CartController::class, 'checkout'])->name('checkout');
            Route::post('/add', [\App\Http\Controllers\CartController::class, 'addProduct'])->name('add');
            Route::post('/remove', [\App\Http\Controllers\CartController::class, 'removeProduct'])->name('remove');
            Route::post('/save', [\App\Http\Controllers\CartController::class, 'save'])->name('save');
            Route::post('/order', [\App\Http\Controllers\CartController::class, 'placeOrder'])->name('order');
            Route::post('/generate-pdf', [\App\Http\Controllers\CartController::class, 'generatePdf'])->name('generate-pdf');
            Route::put('/{cart}/status', [\App\Http\Controllers\CartController::class, 'updateStatus'])->name('update-status');
            Route::delete('/{cart}', [\App\Http\Controllers\CartController::class, 'destroy'])->name('destroy');
        });
    Route::get('dashboard', function (Request $request) {
        $user = $request->user();
        $query = \App\Models\Cart::query()
            ->select(['id', 'user_id', 'status', 'updated_at'])
            ->with([
                'user:id,name,email',
                'products' => function ($q) {
                    $q->select([
                        'products.id',
                        'products.price',
                        'products.price_floor',
                        'products.price_roll',
                        'products.price_promo',
                        'products.cond',
                        'products.floor',
                        'products.roll',
                    ]);
                },
            ]);

        if (!$user->hasRole('admin')) {
            $query->where('user_id', $user->id);
        }

        $carts = $query->latest('updated_at')->limit(200)->get();

        return Inertia::render('dashboard', [
            'carts' => $carts,
        ]);
    })->name('dashboard');

    // Route d'upload générique (gère POST pour l'envoi, PATCH pour les chunks, DELETE pour revert)
    Route::match(['post', 'patch', 'delete'], 'upload', \App\Http\Controllers\UploadController::class)->name('upload');

    // API routes accessibles depuis l'admin (JSON)
    Route::prefix('api')
        ->name('api.')
        ->middleware(['role_or_impersonator:admin'])
        ->group(function () {
            Route::get('/db-products', [\App\Http\Controllers\Api\DbProductsController::class, 'index'])
                ->name('db-products.index');
        });

    // Routes admin des produits - nécessite le rôle admin
    Route::middleware(['role_or_impersonator:admin'])->prefix('admin/products')->name('products.admin.')->group(function () {
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

    Route::post('category-products/reorder', [\App\Http\Controllers\CategoryProductsController::class, 'reorder'])->name('category-products.reorder')->middleware(['role_or_impersonator:admin']);
    Route::get('category-products/children', [\App\Http\Controllers\CategoryProductsController::class, 'children'])->name('category-products.children')->middleware(['role_or_impersonator:admin']);
    // Move endpoint pour dnd-kit (déplacement granulaire)
    Route::post('products/categories/move', [\App\Http\Controllers\CategoryProductsController::class, 'move'])
        ->name('products.categories.move')
        ->middleware(['role_or_impersonator:admin']);
    Route::resource('category-products', \App\Http\Controllers\CategoryProductsController::class)->middleware(['role_or_impersonator:admin']);
    Route::resource('db-products', \App\Http\Controllers\DbProductsController::class)->middleware(['role_or_impersonator:admin']);
    Route::resource('tags-products', \App\Http\Controllers\TagController::class)->middleware(['role_or_impersonator:admin']);
    Route::resource('carriers', CarrierController::class)->middleware(['role_or_impersonator:admin']);
});

// Gestion des utilisateurs consultable par admin et dev
Route::middleware(['role_or_impersonator:admin,dev'])->group(function () {
    Route::get('users', [UserManagementController::class, 'index'])->name('users.index');
    Route::get('admin/users/tree-children', [UserManagementController::class, 'treeChildren'])->name('users.tree-children');
    Route::get('admin/users/tree-search', [UserManagementController::class, 'treeSearch'])->name('users.tree-search');
    Route::get('admin/users/{user}', [UserManagementController::class, 'show'])->name('users.show');
    Route::get('admin/users/{user}/edit', [UserManagementController::class, 'edit'])->name('users.edit');
    Route::put('admin/users/{user}', [UserManagementController::class, 'update'])->name('users.update');
});

// Gestion des utilisateurs réservée aux admins
Route::middleware(['role_or_impersonator:admin'])->group(function () {
    Route::get('admin/media-manager', [MediaController::class, 'index'])->name('media.index');
    Route::get('admin/media-manager/images', [MediaController::class, 'images'])->name('media.images');
    Route::get('admin/media-manager/images/frame', [MediaController::class, 'imagesFrame'])->name('media.images.frame');
    Route::post('admin/media-manager/images/action/download', [MediaController::class, 'actionDownload'])->name('media.images.action.download');
    Route::post('admin/media-manager/images/action/compare', [MediaController::class, 'actionCompare'])->name('media.images.action.compare');
    Route::post('admin/media-manager/images/action/thumbnail', [MediaController::class, 'actionThumbnail'])->name('media.images.action.thumbnail');
    Route::post('admin/media-manager/images/action/batch-download', [MediaController::class, 'actionBatchDownload'])->name('media.images.action.batch-download');

    // Routes statiques d'abord (avant les routes avec {user})
    Route::get('admin/users/create', [UserManagementController::class, 'create'])->name('users.create');
    Route::post('admin/users', [UserManagementController::class, 'store'])->name('users.store');
    Route::get('admin/users/export', [UserManagementController::class, 'export'])->name('users.export');
    Route::post('admin/users/reorder', [UserManagementController::class, 'reorder'])->name('users.reorder');
    
    // Routes avec {user} après
    Route::delete('admin/users/{user}', [UserManagementController::class, 'destroy'])->name('users.destroy');
    Route::get('admin/users/{user}/db', [UserManagementController::class, 'db'])->name('users.db');
    Route::post('admin/users/{user}/role', [UserManagementController::class, 'updateRole'])->name('users.updateRole');
    Route::post('admin/users/{user}/db', [UserManagementController::class, 'editDb'])->name('users.editDb');
    
    // CSV import/export endpoints for users
    Route::post('admin/users/import/process', [UserManagementController::class, 'process'])->name('users.import.process');
    Route::post('admin/users/import/process-chunk', [UserManagementController::class, 'processChunk'])->name('users.import.process_chunk');
    Route::post('admin/users/import/cancel', [UserManagementController::class, 'cancel'])->name('users.import.cancel');
    Route::get('admin/users/import/progress/{id}', [UserManagementController::class, 'progress'])->name('users.import.progress');
    Route::get('admin/users/import/report/{id}', [UserManagementController::class, 'report'])->name('users.import.report');

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
