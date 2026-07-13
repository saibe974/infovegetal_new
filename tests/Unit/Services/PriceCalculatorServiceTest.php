<?php

declare(strict_types=1);

use App\Models\Product;
use App\Models\User;
use App\Http\Controllers\CartController;
use App\Services\PriceCalculatorService;

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
    $product->floor = 2;
    $product->roll = 0;

    expect(invokeCartPricing($product, 8))->toBe([8.0, 64.0]);
});

it('keeps the carton price below the floor threshold', function () {
    $product = makeProduct(10.0, 8.0, 0.0, 0.0);
    $product->cond = 4;
    $product->floor = 2;
    $product->roll = 0;

    expect(invokeCartPricing($product, 7))->toBe([10.0, 70.0]);
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