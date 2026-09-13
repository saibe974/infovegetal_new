<?php

use App\Http\Controllers\ContactController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\Settings\AppearanceController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/settings/files', [\App\Http\Controllers\OrderFileController::class, 'index'])->name('order-files.index');
    Route::get('/order-files/{file}/download', [\App\Http\Controllers\OrderFileController::class, 'download'])->whereNumber('file')->name('order-files.download');
    Route::get('/order-files/{file}/preview', [\App\Http\Controllers\OrderFileController::class, 'preview'])->whereNumber('file')->name('order-files.preview');
    Route::get('/order-files/cart/{cart}/pdf', [\App\Http\Controllers\OrderFileController::class, 'cartPdf'])->whereNumber('cart')->name('order-files.cart-pdf');
});

Route::middleware('auth')->prefix('file-export-templates')->name('file-export-templates.')->group(function () {
    Route::get('/', [\App\Http\Controllers\FileExportTemplateController::class, 'index'])->name('index');
    Route::post('/', [\App\Http\Controllers\FileExportTemplateController::class, 'store'])->name('store');
    Route::delete('/{id}', [\App\Http\Controllers\FileExportTemplateController::class, 'destroy'])->name('destroy');
});
Route::middleware('auth')->prefix('file-export-images')->name('file-export-images.')->group(function () {
    Route::get('/', [\App\Http\Controllers\FileExportImageController::class, 'index'])->name('index');
    Route::post('/', [\App\Http\Controllers\FileExportImageController::class, 'store'])->name('store');
    Route::get('/{id}', [\App\Http\Controllers\FileExportImageController::class, 'show'])->whereNumber('id')->name('show');
});

Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/documentation', [HomeController::class, 'documentation'])->name('documentation');
Route::get('/legals/legal-notices', [HomeController::class, 'legalNotices'])->name('legal.notices');
Route::get('/legals/sale-conditions', [HomeController::class, 'saleConditions'])->name('legal.sale_conditions');
Route::get('/legals/our-policy', [HomeController::class, 'ourPolicy'])->name('legal.our_policy');
Route::get('/contact', [ContactController::class, 'index'])->name('contact');

// Endpoint JSON public pour les propositions de recherche
Route::get('/search-propositions', [SearchController::class, 'propositions'])->name('search.propositions');

// CSRF refresh
Route::get('/csrf-refresh', function () {
    return response()->noContent();
});

Route::get('/appearance', [AppearanceController::class, 'editGuest'])->name('appearance.guest');

require __DIR__.'/products.php';
require __DIR__.'/promotions.php';
require __DIR__.'/cart.php';
require __DIR__.'/users.php';
require __DIR__.'/admin.php';
require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
