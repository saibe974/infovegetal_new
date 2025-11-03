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

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // CSV import/export endpoints (déclarés avant la resource pour éviter les collisions)
    Route::post('products/import', [\App\Http\Controllers\ProductController::class, 'import'])->name('products.import');
    // Nouveaux endpoints pour upload/progress/process JSON
    Route::post('products/import/upload', [\App\Http\Controllers\ProductController::class, 'importUpload'])->name('products.import.upload');
    Route::post('products/import/process', [\App\Http\Controllers\ProductController::class, 'importProcess'])->name('products.import.process');
    Route::get('products/import/progress/{id}', [\App\Http\Controllers\ProductController::class, 'importProgress'])->name('products.import.progress');
    Route::get('products/import/report/{id}', [\App\Http\Controllers\ProductController::class, 'importReport'])->name('products.import.report');
    Route::post('products/import/cancel', [\App\Http\Controllers\ProductController::class, 'importCancel'])->name('products.import.cancel');
    Route::get('products/export', [\App\Http\Controllers\ProductController::class, 'export'])->name('products.export');

    Route::resource('products', \App\Http\Controllers\ProductController::class);

    Route::resource('products-categories', \App\Http\Controllers\ProductCategoryController::class);
    
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
