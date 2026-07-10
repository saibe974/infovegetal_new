<?php

use App\Http\Controllers\ContactController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\SearchController;
use Illuminate\Support\Facades\Route;

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

require __DIR__ . '/products.php';
require __DIR__ . '/cart.php';
require __DIR__ . '/users.php';
require __DIR__ . '/admin.php';
require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
