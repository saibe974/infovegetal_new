<?php

declare(strict_types=1);

use App\Domain\Sales\Services\OrderActorResolver;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

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

    $primaryProduct = new Product();
    $primaryProduct->db_products_id = $primaryDbProductId;

    $secondaryProduct = new Product();
    $secondaryProduct->db_products_id = $secondaryDbProductId;

    $items = collect([
        ['product' => $secondaryProduct, 'line_total' => 150.0],
        ['product' => $primaryProduct, 'line_total' => 240.0],
    ]);

    $resolver = new OrderActorResolver();

    expect($resolver->resolve($client, $items))->toBe([
        'client_user_id' => $client->id,
        'db_product_id' => $primaryDbProductId,
        'billing_user_id' => $billingUser->id,
        'seller_user_id' => $sellerUser->id,
    ]);
});