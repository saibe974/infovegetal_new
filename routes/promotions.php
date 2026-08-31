<?php

use App\Http\Controllers\PromotionAudienceController;
use App\Http\Controllers\PromotionController;
use App\Http\Controllers\PromotionCouponController;
use App\Http\Controllers\PromotionMailingController;
use App\Http\Controllers\PromotionMailingUnsubscribeController;
use App\Http\Controllers\PromotionPageController;
use App\Http\Controllers\PromotionPublicationController;
use Illuminate\Support\Facades\Route;

Route::get('/offres', [PromotionPageController::class, 'index'])->name('offers.index');
Route::get('/offres/{promotion:slug}', [PromotionPageController::class, 'show'])->name('offers.show');

Route::middleware(['signed', 'throttle:30,1'])->group(function (): void {
    Route::get('/promotion-mailing/unsubscribe/{user}', [PromotionMailingUnsubscribeController::class, 'show'])->whereNumber('user')->name('promotions.unsubscribe');
    Route::post('/promotion-mailing/unsubscribe/{user}', [PromotionMailingUnsubscribeController::class, 'unsubscribe'])->whereNumber('user')->name('promotions.unsubscribe.confirm');
});

Route::middleware(['auth', 'verified'])
    ->prefix('promotions')
    ->name('promotions.')
    ->group(function (): void {
        Route::get('/', [PromotionController::class, 'index'])->name('index');
        Route::get('/create', [PromotionController::class, 'create'])->name('create');
        Route::post('/', [PromotionController::class, 'store'])->name('store');
        Route::get('/{promotion}/edit/general', [PromotionController::class, 'editGeneral'])
            ->whereNumber('promotion')
            ->name('edit.general');
        Route::get('/{promotion}/edit/products', [PromotionController::class, 'editProducts'])
            ->whereNumber('promotion')
            ->name('edit.products');
        Route::put('/{promotion}/products', [PromotionController::class, 'updateProducts'])
            ->whereNumber('promotion')
            ->name('products.update');
        Route::get('/{promotion}/products/selectable', [PromotionController::class, 'selectableProducts'])
            ->whereNumber('promotion')
            ->name('products.selectable');
        Route::get('/{promotion}/edit/coupons', [PromotionCouponController::class, 'edit'])
            ->whereNumber('promotion')
            ->name('edit.coupons');
        Route::post('/{promotion}/coupons', [PromotionCouponController::class, 'store'])
            ->whereNumber('promotion')
            ->name('coupons.store');
        Route::put('/{promotion}/coupons/{coupon}', [PromotionCouponController::class, 'update'])
            ->whereNumber(['promotion', 'coupon'])
            ->name('coupons.update');
        Route::delete('/{promotion}/coupons/{coupon}', [PromotionCouponController::class, 'destroy'])
            ->whereNumber(['promotion', 'coupon'])
            ->name('coupons.destroy');
        Route::post('/{promotion}/coupons/{coupon}/simulate', [PromotionCouponController::class, 'simulate'])
            ->whereNumber(['promotion', 'coupon'])
            ->name('coupons.simulate');
        Route::get('/{promotion}/edit/audience', [PromotionAudienceController::class, 'edit'])
            ->whereNumber('promotion')
            ->name('edit.audience');
        Route::put('/{promotion}/audience', [PromotionAudienceController::class, 'update'])
            ->whereNumber('promotion')
            ->name('audience.update');
        Route::get('/{promotion}/audience/propositions', [PromotionAudienceController::class, 'propositions'])
            ->whereNumber('promotion')
            ->name('audience.propositions');
        Route::get('/{promotion}/edit/mailing', [PromotionMailingController::class, 'edit'])->whereNumber('promotion')->name('edit.mailing');
        Route::post('/{promotion}/mailings', [PromotionMailingController::class, 'store'])->whereNumber('promotion')->name('mailings.store');
        Route::put('/{promotion}/mailings/{mailing}', [PromotionMailingController::class, 'update'])->whereNumber(['promotion', 'mailing'])->name('mailings.update');
        Route::delete('/{promotion}/mailings/{mailing}', [PromotionMailingController::class, 'destroy'])->whereNumber(['promotion', 'mailing'])->name('mailings.destroy');
        Route::post('/{promotion}/mailings/{mailing}/prepare', [PromotionMailingController::class, 'prepare'])->whereNumber(['promotion', 'mailing'])->name('mailings.prepare');
        Route::post('/{promotion}/mailings/{mailing}/send-batch', [PromotionMailingController::class, 'sendBatch'])->whereNumber(['promotion', 'mailing'])->middleware('throttle:60,1')->name('mailings.send-batch');
        Route::post('/{promotion}/mailings/{mailing}/cancel', [PromotionMailingController::class, 'cancel'])->whereNumber(['promotion', 'mailing'])->name('mailings.cancel');
        Route::put('/{promotion}', [PromotionController::class, 'update'])
            ->whereNumber('promotion')
            ->name('update');
        Route::get('/{promotion}/edit/presentation', [PromotionPublicationController::class, 'presentation'])->whereNumber('promotion')->name('edit.presentation');
        Route::put('/{promotion}/presentation', [PromotionPublicationController::class, 'updatePresentation'])->whereNumber('promotion')->name('presentation.update');
        Route::get('/{promotion}/edit/publication', [PromotionPublicationController::class, 'publication'])->whereNumber('promotion')->name('edit.publication');
        Route::post('/{promotion}/publication', [PromotionPublicationController::class, 'updatePublication'])->whereNumber('promotion')->name('publication.update');
        Route::get('/{promotion}/preview', [PromotionPageController::class, 'preview'])->whereNumber('promotion')->name('preview');
    });
