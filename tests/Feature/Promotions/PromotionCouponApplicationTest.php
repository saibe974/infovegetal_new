<?php

use App\Http\Controllers\CartController;
use App\Models\Cart;
use App\Models\DbProducts;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use App\Services\OrderSnapshotService;
use App\Services\PromotionCouponApplicationService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

function couponApplicationFixture(array $couponAttributes = []): array
{
    $billing = User::factory()->withoutTwoFactor()->create();
    $seller = User::factory()->withoutTwoFactor()->create();
    $client = User::factory()->withoutTwoFactor()->create();
    $database = DbProducts::create([
        'name' => 'Base coupon '.fake()->unique()->numerify('######'),
        'active' => true,
    ]);
    $product = Product::create([
        'name' => 'Produit coupon',
        'sku' => 'COUPON-'.fake()->unique()->numerify('######'),
        'ref' => 'COUPON-REF-'.fake()->unique()->numerify('######'),
        'ean13' => fake()->unique()->numerify('#############'),
        'price' => 10,
        'price_promo' => 0,
        'active' => true,
        'db_products_id' => $database->id,
    ]);

    $client->dbProducts()->attach($database->id, [
        'attributes' => json_encode(['fact' => $billing->id, 'com' => $seller->id, 'm' => 20]),
    ]);

    $promotion = Promotion::create([
        'title' => 'Promotion applicable',
        'slug' => 'promotion-applicable-'.fake()->unique()->numerify('######'),
        'status' => 'active',
        'visibility' => 'authenticated',
        'created_by_id' => $seller->id,
        'responsible_user_id' => $seller->id,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
    ]);
    $promotion->products()->attach($product->id, [
        'position' => 0,
        'featured' => false,
        'show_before_availability' => false,
    ]);
    $coupon = $promotion->coupons()->create(array_merge([
        'code' => 'ORDER10',
        'discount_type' => 'fixed',
        'discount_value' => 1,
        'scope' => 'promotion_products',
        'funded_by' => 'seller',
        'minimum_order_ht' => 0,
        'usage_limit_per_customer' => 1,
        'stackable_with_promo_price' => true,
        'active' => true,
    ], $couponAttributes));

    return compact('billing', 'seller', 'client', 'database', 'product', 'promotion', 'coupon');
}

function pricedCouponItems(Product $product, float $lineTotal = 12): \Illuminate\Support\Collection
{
    return collect([[
        'product' => $product,
        'quantity' => 1,
        'unit_price' => $lineTotal,
        'line_total' => $lineTotal,
    ]]);
}

test('scheduled coupons become usable without jobs but never beyond the promotion period', function (): void {
    $fixture = couponApplicationFixture(['starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()]);
    $fixture['promotion']->update(['status' => 'scheduled', 'starts_at' => now()->addHour(), 'ends_at' => now()->addHours(2)]);
    $service = app(PromotionCouponApplicationService::class);
    $evaluate = fn () => $service->evaluate($fixture['coupon']->fresh(), $fixture['client'], pricedCouponItems($fixture['product']), 0);
    expect($evaluate)->toThrow(ValidationException::class, 'Ce coupon n’est pas actif.');
    $this->travel(61)->minutes();
    expect($evaluate()['discount_ht'])->toBe(1.0);
    $this->travel(60)->minutes();
    expect($evaluate)->toThrow(ValidationException::class, 'Ce coupon n’est pas actif.');
});

test('a selected-product coupon is evaluated against the seller margin', function (): void {
    $fixture = couponApplicationFixture();

    $result = app(PromotionCouponApplicationService::class)->evaluate(
        $fixture['coupon'],
        $fixture['client'],
        pricedCouponItems($fixture['product']),
        0,
    );

    expect($result['eligible_ht'])->toBe(12.0)
        ->and($result['discount_ht'])->toBe(1.0)
        ->and($result['funder_margin_ht'])->toBe(2.0)
        ->and($result['funder_margin_after_ht'])->toBe(1.0);
});

test('a coupon is rejected when it exceeds the selected funder margin', function (): void {
    $fixture = couponApplicationFixture(['discount_value' => 3]);

    expect(fn () => app(PromotionCouponApplicationService::class)->evaluate(
        $fixture['coupon'],
        $fixture['client'],
        pricedCouponItems($fixture['product']),
        0,
    ))->toThrow(ValidationException::class, 'La remise dépasse la marge disponible du financeur.');
});

test('a billing-funded coupon uses only the billing user margin', function (): void {
    $fixture = couponApplicationFixture([
        'code' => 'BILLING',
        'funded_by' => 'billing_user',
        'discount_value' => 0.5,
    ]);
    DB::table('db_product_billing_user')->insert([
        'db_product_id' => $fixture['database']->id,
        'billing_user_id' => $fixture['billing']->id,
        'defaults' => json_encode(['m' => 10]),
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $result = app(PromotionCouponApplicationService::class)->evaluate(
        $fixture['coupon'],
        $fixture['client'],
        pricedCouponItems($fixture['product'], 11),
        0,
    );

    expect($result['funder_margin_ht'])->toBe(1.0)
        ->and($result['discount_ht'])->toBe(0.5)
        ->and($result['funder_margin_after_ht'])->toBe(0.5);
});

test('a promotion-products coupon requires an eligible product', function (): void {
    $fixture = couponApplicationFixture();
    $otherProduct = Product::create([
        'name' => 'Produit hors promotion',
        'sku' => 'OUT-'.fake()->unique()->numerify('######'),
        'ref' => 'OUT-REF-'.fake()->unique()->numerify('######'),
        'ean13' => fake()->unique()->numerify('#############'),
        'price' => 10,
        'active' => true,
        'db_products_id' => $fixture['database']->id,
    ]);

    expect(fn () => app(PromotionCouponApplicationService::class)->evaluate(
        $fixture['coupon'],
        $fixture['client'],
        pricedCouponItems($otherProduct),
        0,
    ))->toThrow(ValidationException::class, 'Aucun produit du panier n’est éligible');
});

test('a coupon cannot be used before its effective date', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-09-01 10:00:00'));
    $fixture = couponApplicationFixture(['starts_at' => now()->addHour()]);

    expect(fn () => app(PromotionCouponApplicationService::class)->evaluate(
        $fixture['coupon'],
        $fixture['client'],
        pricedCouponItems($fixture['product']),
        0,
    ))->toThrow(ValidationException::class, 'Ce coupon n’est pas encore disponible.');
});

test('a targeted promotion coupon is restricted to its materialized audience', function (): void {
    $fixture = couponApplicationFixture();
    $fixture['promotion']->update(['visibility' => 'targeted']);

    expect(fn () => app(PromotionCouponApplicationService::class)->evaluate(
        $fixture['coupon'],
        $fixture['client'],
        pricedCouponItems($fixture['product']),
        0,
    ))->toThrow(ValidationException::class, 'Ce coupon n’est pas disponible pour votre compte.');

    $fixture['promotion']->audienceUsers()->attach($fixture['client']->id);
    $result = app(PromotionCouponApplicationService::class)->evaluate(
        $fixture['coupon']->fresh(),
        $fixture['client'],
        pricedCouponItems($fixture['product']),
        0,
    );

    expect($result['discount_ht'])->toBe(1.0);
});

test('coupon consumption is idempotent per cart and enforces the customer limit', function (): void {
    $fixture = couponApplicationFixture();
    $service = app(PromotionCouponApplicationService::class);
    $cart = Cart::create(['user_id' => $fixture['client']->id, 'status' => 'processing']);
    $items = pricedCouponItems($fixture['product']);

    $first = $service->consume($fixture['coupon'], $fixture['client'], $cart, $items, 0);
    $second = $service->consume($fixture['coupon'], $fixture['client'], $cart, $items, 0);

    expect($second->id)->toBe($first->id)
        ->and($fixture['coupon']->redemptions()->count())->toBe(1);

    $otherCart = Cart::create(['user_id' => $fixture['client']->id, 'status' => 'processing']);
    expect(fn () => $service->consume($fixture['coupon'], $fixture['client'], $otherCart, $items, 0))
        ->toThrow(ValidationException::class, 'Vous avez déjà utilisé ce coupon.');
});

test('the global usage limit is checked while consuming a coupon', function (): void {
    $fixture = couponApplicationFixture(['usage_limit' => 1, 'usage_limit_per_customer' => 2]);
    $service = app(PromotionCouponApplicationService::class);
    $cart = Cart::create(['user_id' => $fixture['client']->id, 'status' => 'processing']);
    $service->consume($fixture['coupon'], $fixture['client'], $cart, pricedCouponItems($fixture['product']), 0);

    $otherClient = User::factory()->withoutTwoFactor()->create();
    $otherClient->dbProducts()->attach($fixture['database']->id, [
        'attributes' => json_encode(['fact' => $fixture['billing']->id, 'com' => $fixture['seller']->id]),
    ]);
    $otherCart = Cart::create(['user_id' => $otherClient->id, 'status' => 'processing']);

    expect(fn () => $service->consume($fixture['coupon'], $otherClient, $otherCart, pricedCouponItems($fixture['product']), 0))
        ->toThrow(ValidationException::class, 'La limite globale de ce coupon est atteinte.');
});

test('the coupon preview endpoint returns a server validated discount', function (): void {
    $fixture = couponApplicationFixture();

    $this->actingAs($fixture['client'])
        ->postJson(route('cart.coupon.preview', [], false), [
            'coupon_code' => 'order10',
            'items' => [[
                'id' => $fixture['product']->id,
                'quantity' => 1,
                'line_total' => 12,
            ]],
            'shipping_total' => 0,
        ])
        ->assertOk()
        ->assertJson([
            'code' => 'ORDER10',
            'discount_ht' => 1,
            'eligible_ht' => 12,
            'funded_by' => 'seller',
        ]);
});

test('the order snapshot keeps an immutable coupon reference and audit data', function (): void {
    $fixture = couponApplicationFixture();
    $cart = Cart::create([
        'user_id' => $fixture['client']->id,
        'status' => 'processing',
        'promotion_coupon_id' => $fixture['coupon']->id,
        'coupon_code' => $fixture['coupon']->code,
    ]);

    $order = app(OrderSnapshotService::class)->createFromPayload(
        $cart,
        $fixture['client'],
        [
            'items' => pricedCouponItems($fixture['product']),
            'items_total' => 12,
            'shipping_total' => 0,
            'discount_total' => 1,
            'total' => 11,
            'coupon' => [
                'id' => $fixture['coupon']->id,
                'code' => $fixture['coupon']->code,
                'discount_ht' => 1,
                'funded_by' => 'seller',
            ],
        ],
    );

    expect($order->promotion_coupon_id)->toBe($fixture['coupon']->id)
        ->and($order->coupon_code)->toBe('ORDER10')
        ->and((float) $order->discount_total_ht)->toBe(1.0)
        ->and($order->meta['coupon']['code'])->toBe('ORDER10');
});

test('the final cart payload recalculates and applies the coupon on the server', function (): void {
    $fixture = couponApplicationFixture();
    $cart = Cart::create(['user_id' => $fixture['client']->id, 'status' => 'processing']);
    $method = new ReflectionMethod(CartController::class, 'buildPdfPayload');
    $method->setAccessible(true);

    $payload = $method->invoke(
        new CartController,
        [['id' => $fixture['product']->id, 'quantity' => 1]],
        $fixture['client'],
        0,
        false,
        [],
        [],
        [],
        null,
        'order10',
        $cart,
    );

    expect((float) $payload['items_total'])->toBe(12.0)
        ->and($payload['coupon']['code'])->toBe('ORDER10')
        ->and($payload['discount_total'])->toBe(1.0)
        ->and($payload['total'])->toBe(11.0);
});
