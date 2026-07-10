<?php

use App\Http\Controllers\CarrierController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\UploadController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    // Route d'upload générique (gère POST pour l'envoi, PATCH pour les chunks, DELETE pour revert)
    Route::match(['post', 'patch', 'delete'], 'upload', UploadController::class)->name('upload');

    // Carriers
    Route::post('carriers/{carrier}/zones/import', [CarrierController::class, 'importZones'])
        ->whereNumber('carrier')
        ->name('carriers.zones.import')
        ->middleware(['role_or_impersonator:admin']);
    Route::resource('carriers', CarrierController::class)->middleware(['role_or_impersonator:admin']);
});

// Media manager — admin uniquement
Route::middleware(['role_or_impersonator:admin'])->prefix('admin/media-manager')->name('media.')->group(function () {
    Route::get('/', [MediaController::class, 'index'])->name('index');
    Route::get('/images', [MediaController::class, 'images'])->name('images');
    Route::get('/images/frame', [MediaController::class, 'imagesFrame'])->name('images.frame');
    Route::post('/images/action/download', [MediaController::class, 'actionDownload'])->name('images.action.download');
    Route::post('/images/action/compare', [MediaController::class, 'actionCompare'])->name('images.action.compare');
    Route::post('/images/action/thumbnail', [MediaController::class, 'actionThumbnail'])->name('images.action.thumbnail');
    Route::post('/images/action/remove-missing-img-link', [MediaController::class, 'actionRemoveMissingImgLink'])->name('images.action.remove-missing-img-link');
    Route::post('/images/action/batch-download', [MediaController::class, 'actionBatchDownload'])->name('images.action.batch-download');
});
