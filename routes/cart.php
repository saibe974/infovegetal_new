<?php

use App\Http\Controllers\CartController;
use App\Services\UserManagementAuthorizationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::prefix('cart')->name('cart.')->group(function () {
        Route::get('/', [CartController::class, 'index'])->name('index');
        Route::get('/checkout', [CartController::class, 'checkout'])->name('checkout');
        Route::post('/add', [CartController::class, 'addProduct'])->name('add');
        Route::post('/remove', [CartController::class, 'removeProduct'])->name('remove');
        Route::post('/save', [CartController::class, 'save'])->name('save');
        Route::post('/order', [CartController::class, 'placeOrder'])->name('order');
        Route::post('/generate-pdf', [CartController::class, 'generatePdf'])->name('generate-pdf');
        Route::post('/generate-pdf-tcpdf', [CartController::class, 'generatePdfTcpdf'])->name('generate-pdf-tcpdf');
        Route::put('/{cart}/status', [CartController::class, 'updateStatus'])->name('update-status');
        Route::delete('/{cart}', [CartController::class, 'destroy'])->name('destroy');
    });

    Route::get('dashboard', function (Request $request) {
        $user = $request->user();
        $authorization = app(UserManagementAuthorizationService::class);

        abort_unless($authorization->canViewAnyOrders($user), 403);

        $query = \App\Models\Cart::query()
            ->select(['id', 'user_id', 'status', 'items_total', 'shipping_total', 'created_at', 'updated_at'])
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

        $authorization->scopeManageableOrders($user, $query);

        $carts = $query->latest('updated_at')->limit(200)->get()->map(function ($cart) {
            $itemsTotal = round((float) ($cart->items_total ?? 0), 2);
            $shippingTotal = round((float) ($cart->shipping_total ?? 0), 2);
            $cart->computed_total = round($itemsTotal + $shippingTotal, 2);

            $orderNumber = str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT);
            $date = optional($cart->created_at)->format('Y_m_d')
                ?: optional($cart->updated_at)->format('Y_m_d')
                ?: now()->format('Y_m_d');
            $cart->pdf_filename = $orderNumber . '_' . $date . '.pdf';

            return $cart;
        });

        return Inertia::render('dashboard', [
            'carts' => $carts,
        ]);
    })->name('dashboard');
});
