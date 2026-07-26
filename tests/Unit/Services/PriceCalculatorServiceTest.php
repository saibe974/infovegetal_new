<?php

declare(strict_types=1);

use App\Models\Product;
use App\Models\User;
use App\Http\Controllers\CartController;
use App\Services\PriceCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

function makeProduct(?float $price, ?float $priceFloor = null, ?float $priceRoll = null, ?float $pricePromo = null): Product
{
    $product = new Product();
    $product->price = $price;
    $product->price_floor = $priceFloor;
    $product->price_roll = $priceRoll;
    $product->price_promo = $pricePromo;

    return $product;
}

function makeUser(): User
{
    $user = new User();
    $user->id = 1;

    return $user;
}

it('returns the standard unit price unchanged when it is available', function () {
    $service = new class extends PriceCalculatorService {
        protected function getUserAttributes(User $user, int $dbProductId): ?array
        {
            return null;
        }
    };

    $prices = $service->calculatePrice(
        makeProduct(12.34, 18.0, 24.0, 0.0),
        makeUser(),
        42,
    );

    expect($prices)->toBe([12.34, 18.0, 24.0, 0.0]);
});

it('falls back to a minimal positive standard price when all base prices are absent', function () {
    $service = new class extends PriceCalculatorService {
        protected function getUserAttributes(User $user, int $dbProductId): ?array
        {
            return null;
        }
    };

    $prices = $service->calculatePrice(
        makeProduct(0.0, 0.0, 0.0, 0.0),
        makeUser(),
        42,
    );

    expect($prices)->toBe([0.01, 0.01, 0.01, 0.0]);
});

it('forces a positive minimum when the standard price is negative', function () {
    $service = new class extends PriceCalculatorService {
        protected function getUserAttributes(User $user, int $dbProductId): ?array
        {
            return null;
        }
    };

    $prices = $service->calculatePrice(
        makeProduct(-5.0, -3.0, -2.0, 0.0),
        makeUser(),
        42,
    );

    expect($prices)->toBe([0.01, 0.01, 0.01, 0.0]);
});

function invokeCartPricing(Product $product, int $quantity, ?User $user = null): array
{
    $controller = new CartController();
    $method = new ReflectionMethod($controller, 'getCartPricing');
    $method->setAccessible(true);

    return $method->invoke($controller, $product, $quantity, $user, new PriceCalculatorService());
}

it('applies the carton price exactly at the carton threshold', function () {
    $product = makeProduct(10.0, 8.0, 0.0, 0.0);
    $product->cond = 4;
    $product->floor = 2;
    $product->roll = 0;

    expect(invokeCartPricing($product, 4))->toBe([10.0, 40.0]);
});

it('keeps the standard unit price below the carton threshold', function () {
    $product = makeProduct(10.0, 8.0, 0.0, 0.0);
    $product->cond = 4;
    $product->floor = 2;
    $product->roll = 0;

    expect(invokeCartPricing($product, 7))->toBe([10.0, 70.0]);
});

it('applies the floor price exactly at the floor threshold', function () {
    $product = makeProduct(10.0, 8.0, 0.0, 0.0);
    $product->cond = 4;
    $product->floor = 3;
    $product->roll = 0;

    expect(invokeCartPricing($product, 12))->toBe([8.0, 96.0]);
});

it('keeps the carton price below the floor threshold', function () {
    $product = makeProduct(10.0, 8.0, 0.0, 0.0);
    $product->cond = 4;
    $product->floor = 3;
    $product->roll = 0;

    expect(invokeCartPricing($product, 11))->toBe([10.0, 110.0]);
});

it('applies the roll price exactly at the roll threshold', function () {
    $product = makeProduct(10.0, 8.0, 7.0, 0.0);
    $product->cond = 4;
    $product->floor = 2;
    $product->roll = 3;

    expect(invokeCartPricing($product, 24))->toBe([7.0, 168.0]);
});

it('keeps the floor price below the roll threshold', function () {
    $product = makeProduct(10.0, 8.0, 7.0, 0.0);
    $product->cond = 4;
    $product->floor = 2;
    $product->roll = 3;

    expect(invokeCartPricing($product, 23))->toBe([8.0, 184.0]);
});

it('applies the promo price instead of the roll price when promo is active', function () {
    $product = makeProduct(10.0, 8.0, 7.0, 6.0);
    $product->cond = 4;
    $product->floor = 2;
    $product->roll = 3;

    expect(invokeCartPricing($product, 24))->toBe([6.0, 144.0]);
});

it('falls back from roll to floor when roll is missing', function () {
    $product = makeProduct(10.0, 8.0, null, 0.0);

    expect($product->price_roll)->toBe('8.00');
});

it('falls back from roll to standard price when roll and floor are missing', function () {
    $product = makeProduct(10.0, null, null, 0.0);

    expect($product->price_roll)->toBe('10.00');
});

it('keeps the raw value when no fallback source exists', function () {
    $product = makeProduct(null, null, null, 0.0);

    expect($product->price_roll)->toBeNull();
});

it('applies the legacy special price when the special source is active', function () {
    $product = makeProduct(10.0, 8.0, 7.0, 0.0);
    $product->price_special_1 = 17.5;

    $service = new class extends PriceCalculatorService {
        protected function getUserAttributes(User $user, int $dbProductId): ?array
        {
            return ['p' => 'price_special_1'];
        }
    };

    $prices = $service->calculatePrice($product, makeUser(), 42);

    expect($prices)->toBe([17.5, 17.5, 17.5, 0.0]);
});

it('falls back to the standard price when the special source is absent', function () {
    $product = makeProduct(10.0, 8.0, 7.0, 0.0);

    $service = new class extends PriceCalculatorService {
        protected function getUserAttributes(User $user, int $dbProductId): ?array
        {
            return ['p' => 'price_special_1'];
        }
    };

    $prices = $service->calculatePrice($product, makeUser(), 42);

    expect($prices)->toBe([10.0, 10.0, 10.0, 0.0]);
});

it('applies the billing profile selected through the billing to seller relation', function (): void {
    $client = User::factory()->withoutTwoFactor()->create();
    $billingUser = User::factory()->withoutTwoFactor()->create();
    $sellerUser = User::factory()->withoutTwoFactor()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-price-calculator-billing-profile',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_billing_user')->insert([
        'db_product_id' => $dbProductId,
        'billing_user_id' => $billingUser->id,
        'defaults' => json_encode([
            'default_profile_id' => 'base',
            'profiles' => [
                ['id' => 'base', 'conditions' => ['m' => 5]],
                ['id' => 'pro', 'conditions' => ['m' => 30]],
            ],
        ]),
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_seller_user')->insert([
        'db_product_id' => $dbProductId,
        'seller_user_id' => $sellerUser->id,
        'billing_user_id' => $billingUser->id,
        'conditions' => json_encode([]),
        'seller_defaults' => json_encode([]),
        'use_billing_profile' => true,
        'billing_profile_id' => 'pro',
        'can_manage' => false,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('client_sales_conditions')->insert([
        'client_user_id' => $client->id,
        'db_product_id' => $dbProductId,
        'billing_user_id' => $billingUser->id,
        'seller_user_id' => $sellerUser->id,
        'conditions_override' => json_encode([]),
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $prices = (new PriceCalculatorService())->calculatePrice(
        makeProduct(10.0, 8.0, 7.0, 0.0),
        $client,
        $dbProductId,
    );

    expect($prices)->toBe([13.0, 10.4, 9.1, 0.0]);
});

it('applies billing-only client conditions when no seller is selected', function (): void {
    $client = User::factory()->withoutTwoFactor()->create();
    $billingUser = User::factory()->withoutTwoFactor()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-price-calculator-billing-only',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_billing_user')->insert([
        'db_product_id' => $dbProductId,
        'billing_user_id' => $billingUser->id,
        'defaults' => json_encode([
            'default_profile_id' => 'base',
            'profiles' => [
                ['id' => 'base', 'conditions' => ['m' => 5]],
            ],
        ]),
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('client_sales_conditions')->insert([
        'client_user_id' => $client->id,
        'db_product_id' => $dbProductId,
        'billing_user_id' => $billingUser->id,
        'seller_user_id' => null,
        'conditions_override' => json_encode(['m' => 25]),
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $prices = (new PriceCalculatorService())->calculatePrice(
        makeProduct(10.0, 8.0, 7.0, 0.0),
        $client,
        $dbProductId,
    );

    expect($prices)->toBe([12.5, 10.0, 8.75, 0.0]);
});