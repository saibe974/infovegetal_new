<?php

declare(strict_types=1);

use App\Domain\Sales\Services\SalesConditionRelationResolver;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

/**
 * Business Rules:
 * BR-020
 */
it('prefers the billing-specific seller rule over the generic relation rule', function (): void {
    $billingUser = User::factory()->create();
    $sellerUser = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-relation-profile',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_seller_user')->insert([
        [
            'db_product_id' => $dbProductId,
            'seller_user_id' => $sellerUser->id,
            'billing_user_id' => null,
            'conditions' => json_encode(['priority' => 'generic']),
            'seller_defaults' => json_encode(['priority' => 'generic-defaults']),
            'use_billing_profile' => true,
            'billing_profile_id' => 'base',
            'active' => true,
        ],
        [
            'db_product_id' => $dbProductId,
            'seller_user_id' => $sellerUser->id,
            'billing_user_id' => $billingUser->id,
            'conditions' => json_encode(['priority' => 'specific']),
            'seller_defaults' => json_encode(['priority' => 'specific-defaults']),
            'use_billing_profile' => false,
            'billing_profile_id' => 'pro',
            'active' => true,
        ],
    ]);

    $resolver = new SalesConditionRelationResolver();

    expect($resolver->resolveSellerRuleData($dbProductId, $billingUser->id, $sellerUser->id))->toBe([
        'conditions' => ['priority' => 'specific'],
        'seller_defaults' => ['priority' => 'specific-defaults'],
        'use_billing_profile' => false,
        'billing_profile_id' => 'pro',
    ]);
});

/**
 * Business Rules:
 * BR-021
 */
it('returns the active client override for the exact client billing and seller relation', function (): void {
    $client = User::factory()->create();
    $billingUser = User::factory()->create();
    $sellerUser = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-client-override-relation',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('client_sales_conditions')->insert([
        'client_user_id' => $client->id,
        'db_product_id' => $dbProductId,
        'billing_user_id' => $billingUser->id,
        'seller_user_id' => $sellerUser->id,
        'conditions_override' => json_encode(['priority' => 'client', 'shipping' => ['fee' => 30]]),
        'active' => true,
    ]);

    $resolver = new SalesConditionRelationResolver();

    expect($resolver->resolveClientOverride($dbProductId, $billingUser->id, $sellerUser->id, $client->id))->toBe([
        'priority' => 'client',
        'shipping' => ['fee' => 30],
    ]);
});