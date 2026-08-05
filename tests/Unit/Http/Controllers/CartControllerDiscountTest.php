<?php

declare(strict_types=1);

use App\Http\Controllers\CartController;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Symfony\Component\HttpKernel\Exception\HttpException;

uses(Tests\TestCase::class, RefreshDatabase::class);

function calculateCartDiscounts(array $items, float $shippingTotal, array $discounts, array $shippingByDb): array
{
    $method = new ReflectionMethod(CartController::class, 'calculateDiscountSummary');
    $method->setAccessible(true);

    return $method->invoke(new CartController(), collect($items), $shippingTotal, $discounts, $shippingByDb);
}

function normalizeCartDiscounts(User $user, array $discounts): array
{
    $method = new ReflectionMethod(CartController::class, 'normalizeDiscounts');
    $method->setAccessible(true);

    return $method->invoke(new CartController(), $discounts, $user);
}

it('applies percent and fixed discounts to each db total including shipping', function (): void {
    $firstProduct = new Product(['name' => 'DB 1']);
    $firstProduct->db_products_id = 10;
    $secondProduct = new Product(['name' => 'DB 2']);
    $secondProduct->db_products_id = 20;

    $summary = calculateCartDiscounts(
        [
            ['product' => $firstProduct, 'line_total' => 100.0],
            ['product' => $secondProduct, 'line_total' => 50.0],
        ],
        30.0,
        [
            10 => ['type' => 'percent', 'value' => 10.0],
            20 => ['type' => 'fixed', 'value' => 100.0],
        ],
        [10 => 20.0, 20 => 10.0],
    );

    expect($summary['by_db'][10]['base'])->toBe(120.0)
        ->and($summary['by_db'][10]['amount'])->toBe(12.0)
        ->and($summary['by_db'][20]['base'])->toBe(60.0)
        ->and($summary['by_db'][20]['amount'])->toBe(60.0)
        ->and($summary['total'])->toBe(72.0);
});

it('allows discounts for commercial users and users with the dedicated permission', function (): void {
    $commercialRole = Role::create(['name' => 'commercial']);
    $commercial = User::factory()->create();
    $commercial->assignRole($commercialRole);

    $permission = Permission::create(['name' => 'order.remise']);
    $permittedUser = User::factory()->create();
    $permittedUser->givePermissionTo($permission);

    $discount = [12 => ['type' => 'percent', 'value' => 120]];

    expect(normalizeCartDiscounts($commercial, $discount)[12])
        ->toBe(['type' => 'percent', 'value' => 100.0])
        ->and(normalizeCartDiscounts($permittedUser, $discount)[12])
        ->toBe(['type' => 'percent', 'value' => 100.0]);
});

it('rejects discounts from unauthorized users', function (): void {
    normalizeCartDiscounts(
        User::factory()->create(),
        [12 => ['type' => 'fixed', 'value' => 10]],
    );
})->throws(HttpException::class);
