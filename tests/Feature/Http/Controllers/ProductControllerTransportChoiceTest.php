<?php

declare(strict_types=1);

use App\Http\Controllers\ProductController;
use App\Models\Carrier;
use App\Models\CarrierZone;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

uses(RefreshDatabase::class);

function createProductWithTransportChoice(string $name, User $user, int $dbProductId, array $transportAttributes): Product
{
    $ean13 = str_pad((string) (($dbProductId % 1000000000000) + 1000000000000), 13, '0', STR_PAD_LEFT);

    DB::table('db_product_user')->insert([
        'db_product_id' => $dbProductId,
        'user_id' => $user->id,
        'attributes' => json_encode($transportAttributes),
    ]);

    return Product::create([
        'sku' => $name,
        'name' => $name,
        'description' => null,
        'img_link' => null,
        'price' => 10,
        'active' => true,
        'attributes' => [],
        'category_products_id' => null,
        'db_products_id' => $dbProductId,
        'ref' => $name,
        'ean13' => $ean13,
        'pot' => null,
        'height' => null,
        'price_floor' => 9,
        'price_roll' => 8,
        'price_promo' => 0,
        'producer_id' => null,
        'tva_id' => null,
        'cond' => null,
        'floor' => null,
        'roll' => null,
        'unite' => null,
    ]);
}

function productControllerPayload(User $user, array $query = []): array
{
    $request = Request::create(route('products.index'), 'GET', $query, [], [], [
        'HTTP_X_INERTIA' => 'true',
        'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
    ]);
    $request->setUserResolver(fn () => $user);

    $response = app(ProductController::class)->index($request);
    $content = $response->toResponse($request)->getContent();

    return is_string($content) ? json_decode($content, true) : [];
}

/**
 * Business Rules:
 * BR-037
 */
it('keeps only the authorized carrier and zone pairing on the products page', function (): void {
    $user = User::factory()->create();

    $carrierA = Carrier::create([
        'name' => 'Carrier A',
        'country' => 'FR',
        'days' => 2,
        'minimum' => 0,
        'taxgo' => 0,
    ]);
    $carrierB = Carrier::create([
        'name' => 'Carrier B',
        'country' => 'FR',
        'days' => 3,
        'minimum' => 0,
        'taxgo' => 0,
    ]);

    $zoneA = CarrierZone::create([
        'carrier_id' => $carrierA->id,
        'name' => 'Zone A',
        'tariffs' => ['mini' => 120, 'roll:1-3' => 150],
    ]);
    $zoneB = CarrierZone::create([
        'carrier_id' => $carrierB->id,
        'name' => 'Zone B',
        'tariffs' => ['mini' => 130, 'roll:1-3' => 160],
    ]);

    $authorizedDbProductId = DB::table('db_products')->insertGetId([
        'name' => 'authorized-db-product',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $rejectedDbProductId = DB::table('db_products')->insertGetId([
        'name' => 'rejected-db-product',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    createProductWithTransportChoice('A authorized product', $user, $authorizedDbProductId, [
        't' => $carrierA->id,
        'z' => $zoneA->id,
    ]);

    createProductWithTransportChoice('B rejected product', $user, $rejectedDbProductId, [
        't' => $carrierA->id,
        'z' => $zoneB->id,
    ]);

    $payload = productControllerPayload($user, ['sort' => 'name', 'dir' => 'asc']);
    $collection = $payload['props']['collection']['data'] ?? [];

    expect($payload['component'] ?? null)->toBe('products/index')
        ->and($collection)->toHaveCount(2)
        ->and($collection[0]['name'] ?? null)->toBe('A authorized product')
        ->and($collection[0]['db_user_transport']['carrier_id'] ?? null)->toBe($carrierA->id)
        ->and($collection[0]['db_user_transport']['zone_id'] ?? null)->toBe($zoneA->id)
        ->and($collection[1]['name'] ?? null)->toBe('B rejected product')
        ->and($collection[1]['db_user_transport'] ?? null)->toBeNull();
});

/**
 * Business Rules:
 * BR-037
 */
it('returns no transport context when no choice is provided', function (): void {
    $user = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'no-choice-db-product',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_user')->insert([
        'db_product_id' => $dbProductId,
        'user_id' => $user->id,
        'attributes' => json_encode([]),
    ]);

    Product::create([
        'sku' => 'no-choice-product',
        'name' => 'No choice product',
        'description' => null,
        'img_link' => null,
        'price' => 10,
        'active' => true,
        'attributes' => [],
        'category_products_id' => null,
        'db_products_id' => $dbProductId,
        'ref' => 'no-choice-product',
        'ean13' => str_pad((string) (($dbProductId % 1000000000000) + 1000000000000), 13, '0', STR_PAD_LEFT),
        'pot' => null,
        'height' => null,
        'price_floor' => 9,
        'price_roll' => 8,
        'price_promo' => 0,
        'producer_id' => null,
        'tva_id' => null,
        'cond' => null,
        'floor' => null,
        'roll' => null,
        'unite' => null,
    ]);

    $payload = productControllerPayload($user, ['sort' => 'name', 'dir' => 'asc']);
    $collection = $payload['props']['collection']['data'] ?? [];

    expect($payload['component'] ?? null)->toBe('products/index')
        ->and($collection)->toHaveCount(1)
        ->and($collection[0]['db_user_transport'] ?? null)->toBeNull();
});