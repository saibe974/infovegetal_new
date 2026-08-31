<?php

declare(strict_types=1);

use App\Domain\Sales\Services\OrderActorResolver;
use App\Models\ClientSalesCondition;
use App\Models\DbProducts;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('fills missing legacy actors from the latest active client conditions', function (array $legacyKeys): void {
    $client = User::factory()->create();
    $billing = User::factory()->create();
    $seller = User::factory()->create();
    $legacyActor = User::factory()->create();
    $database = DbProducts::create(['name' => 'Actor fallback', 'active' => true]);
    $attributes = array_fill_keys($legacyKeys, $legacyActor->id);
    if ($attributes !== []) {
        $client->dbProducts()->attach($database->id, ['attributes' => json_encode($attributes)]);
    }
    $condition = [
        'client_user_id' => $client->id,
        'db_product_id' => $database->id,
        'billing_user_id' => $billing->id,
        'seller_user_id' => $seller->id,
        'conditions_override' => [],
        'active' => true,
    ];
    ClientSalesCondition::create(array_replace($condition, ['billing_user_id' => $legacyActor->id]));
    ClientSalesCondition::create($condition);
    ClientSalesCondition::create(array_replace($condition, [
        'billing_user_id' => $legacyActor->id, 'seller_user_id' => $legacyActor->id, 'active' => false,
    ]));
    ClientSalesCondition::create(array_replace($condition, ['client_user_id' => $legacyActor->id]));
    $otherDatabase = DbProducts::create(['name' => 'Other actor base', 'active' => true]);
    ClientSalesCondition::create(array_replace($condition, ['db_product_id' => $otherDatabase->id]));

    $product = new Product(['db_products_id' => $database->id]);
    $result = (new OrderActorResolver)->resolve($client, collect([['product' => $product, 'line_total' => 12]]));

    expect($result)->toBe([
        'client_user_id' => $client->id,
        'db_product_id' => $database->id,
        'billing_user_id' => isset($attributes['fact']) ? $legacyActor->id : $billing->id,
        'seller_user_id' => isset($attributes['com']) ? $legacyActor->id : $seller->id,
    ]);
})->with([
    'no legacy link' => [[]],
    'legacy billing only' => [['fact']],
    'legacy seller only' => [['com']],
    'legacy actors take priority' => [['fact', 'com']],
]);

it('does not infer actors from inactive client conditions', function (): void {
    $client = User::factory()->create();
    $billing = User::factory()->create();
    $database = DbProducts::create(['name' => 'Inactive actor fallback', 'active' => true]);
    ClientSalesCondition::create([
        'client_user_id' => $client->id,
        'db_product_id' => $database->id,
        'billing_user_id' => $billing->id,
        'seller_user_id' => null,
        'conditions_override' => [],
        'active' => false,
    ]);

    $result = (new OrderActorResolver)->resolve($client, collect([
        ['product' => new Product(['db_products_id' => $database->id]), 'line_total' => 12],
    ]));

    expect($result['billing_user_id'])->toBeNull()
        ->and($result['seller_user_id'])->toBeNull();
});

/**
 * Business Rules:
 * BR-013
 * BR-011
 * BR-012
 */
it('resolves the dominant db product billing user and seller user', function (): void {
    $client = User::factory()->create();
    $billingUser = User::factory()->create();
    $sellerUser = User::factory()->create();

    $primaryDbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-primary',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $secondaryDbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-secondary',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_user')->insert([
        [
            'db_product_id' => $primaryDbProductId,
            'user_id' => $client->id,
            'attributes' => json_encode(['fact' => $billingUser->id, 'com' => $sellerUser->id]),
        ],
        [
            'db_product_id' => $secondaryDbProductId,
            'user_id' => $client->id,
            'attributes' => json_encode(['fact' => $sellerUser->id]),
        ],
    ]);

    $primaryProduct = new Product;
    $primaryProduct->db_products_id = $primaryDbProductId;

    $secondaryProduct = new Product;
    $secondaryProduct->db_products_id = $secondaryDbProductId;

    $items = collect([
        ['product' => $secondaryProduct, 'line_total' => 150.0],
        ['product' => $primaryProduct, 'line_total' => 240.0],
    ]);

    $resolver = new OrderActorResolver;

    expect($resolver->resolve($client, $items))->toBe([
        'client_user_id' => $client->id,
        'db_product_id' => $primaryDbProductId,
        'billing_user_id' => $billingUser->id,
        'seller_user_id' => $sellerUser->id,
    ]);
});
