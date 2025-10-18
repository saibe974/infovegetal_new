<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::resource('products', \App\Http\Controllers\ProductController::class);
    // CSV import/export endpoints
    Route::post('products/import', [\App\Http\Controllers\ProductController::class, 'import'])->name('products.import');
    Route::get('products/export', [\App\Http\Controllers\ProductController::class, 'export'])->name('products.export');

    Route::resource('products-categories', \App\Http\Controllers\ProductCategoryController::class);
    
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
