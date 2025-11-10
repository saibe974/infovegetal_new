<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Product;
use App\Http\Resources\ProductResource;

Route::get('/', function (Request $request) {
    $query = Product::with(['category'])->orderFromRequest($request);
    $search = $request->get('q');

    if ($search) {
        $normalized = trim($search);
        $tokens = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $isSingleNumeric = count($tokens) === 1 && ctype_digit($tokens[0]);

        $query->where(function ($q) use ($tokens, $isSingleNumeric) {
            if ($isSingleNumeric) {
                $q->where('id', '=', (int) $tokens[0]);
            }
            $q->orWhere(function ($qq) use ($tokens) {
                foreach ($tokens as $t) {
                    $qq->where('name', 'like', '%' . $t . '%');
                }
            });
        });
    }

    return Inertia::render('home', [
        'q' => $search,
        'collection' => Inertia::scroll(fn () => ProductResource::collection(
            $query->paginate(10)
        )),
        // Optionnel: suggestions de recherche. Laisser vide pour l'instant.
        'searchPropositions' => Inertia::optional(fn () => []),
    ]);
})->name('home');

// Routes publiques de consultation des produits
Route::prefix('products')->name('products.')->group(function () {
    Route::get('/', [\App\Http\Controllers\ProductController::class, 'index'])->name('index');
    Route::get('/{product}', [\App\Http\Controllers\ProductController::class, 'show'])->name('show');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // Routes admin des produits - nécessite le rôle admin
    Route::middleware(['role:admin'])->prefix('admin/products')->name('products.admin.')->group(function () {
        Route::get('/', [\App\Http\Controllers\ProductController::class, 'index'])->name('index');
        Route::get('/create', [\App\Http\Controllers\ProductController::class, 'create'])->name('create');
        Route::post('/', [\App\Http\Controllers\ProductController::class, 'store'])->name('store');
        Route::get('/{product}/edit', [\App\Http\Controllers\ProductController::class, 'edit'])->name('edit');
        Route::put('/{product}', [\App\Http\Controllers\ProductController::class, 'update'])->name('update');
        Route::delete('/{product}', [\App\Http\Controllers\ProductController::class, 'destroy'])->name('destroy');
        
        // CSV import/export endpoints
        Route::post('/import/upload', [\App\Http\Controllers\ProductController::class, 'importUpload'])->name('import.upload');
        Route::post('/import/process', [\App\Http\Controllers\ProductController::class, 'importProcess'])->name('import.process');
        Route::post('/import/cancel', [\App\Http\Controllers\ProductController::class, 'importCancel'])->name('import.cancel');
        Route::get('/import/progress/{id}', [\App\Http\Controllers\ProductController::class, 'importProgress'])->name('import.progress');
        Route::get('/import/report/{id}', [\App\Http\Controllers\ProductController::class, 'importReport'])->name('import.report');
        Route::get('/export', [\App\Http\Controllers\ProductController::class, 'export'])->name('export');
    });

    Route::resource('products-categories', \App\Http\Controllers\ProductCategoryController::class)->middleware(['role:admin']);
    
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
