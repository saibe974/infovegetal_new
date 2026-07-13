<?php

declare(strict_types=1);

use App\Models\Product;
use App\Models\User;
use App\Models\Cart;
use App\Models\DbProducts;
use App\Models\OrderHeader;
use App\Services\OrderSnapshotService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('resolves the primary db product deterministically and extracts billing and seller actors', function (): void {
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

    $service = new OrderSnapshotService();
    $method = new ReflectionMethod($service, 'resolveActors');
    $method->setAccessible(true);

    $actors = $method->invoke($service, $client, $items);

    expect($actors)->toBe([
        'db_product_id' => $primaryDbProductId,
        'billing_user_id' => $billingUser->id,
        'seller_user_id' => $sellerUser->id,
    ]);
});

it('stores resolved actors in the order snapshot metadata', function (): void {
    $client = User::factory()->create();
    $billingUser = User::factory()->create();
    $sellerUser = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-snapshot-meta',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_user')->insert([
        'db_product_id' => $dbProductId,
        'user_id' => $client->id,
        'attributes' => json_encode(['fact' => $billingUser->id, 'com' => $sellerUser->id]),
    ]);

    $cart = Cart::create([
        'user_id' => $client->id,
        'status' => 'processing',
    ]);

    $product = Product::query()->create([
        'sku' => 'snapshot-meta-product',
        'name' => 'Snapshot meta product',
        'description' => null,
        'img_link' => null,
        'price' => 10,
        'active' => true,
        'attributes' => null,
        'ref' => 'SNAPSHOT-META',
        'ean13' => '1234567890123',
        'db_products_id' => $dbProductId,
    ]);
    $product->setRelation('dbProduct', DbProducts::query()->findOrFail($dbProductId));

    $service = new OrderSnapshotService();
    $orderHeader = $service->createFromPayload($cart, $client, [
        'items' => [
            [
                'product' => $product,
                'quantity' => 2,
                'unit_price' => 10,
                'line_total' => 20,
            ],
        ],
        'items_total' => 20,
        'shipping_total' => 0,
        'total' => 20,
    ], [
        'source' => 'unit-test',
    ]);

    expect($orderHeader)->toBeInstanceOf(OrderHeader::class)
        ->and($orderHeader->meta)->toMatchArray([
            'source' => 'unit-test',
            'resolved_actors' => [
                'db_product_id' => $dbProductId,
                'billing_user_id' => $billingUser->id,
                'seller_user_id' => $sellerUser->id,
            ],
        ]);
});

it('returns a null billing user when the relation has no billing actor', function (): void {
    $client = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-no-billing',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_user')->insert([
        'db_product_id' => $dbProductId,
        'user_id' => $client->id,
        'attributes' => json_encode(['com' => null]),
    ]);

    $product = new Product();
    $product->db_products_id = $dbProductId;

    $service = new OrderSnapshotService();
    $method = new ReflectionMethod($service, 'resolveActors');
    $method->setAccessible(true);

    $actors = $method->invoke($service, $client, collect([
        ['product' => $product, 'line_total' => 100.0],
    ]));

    expect($actors)->toBe([
        'db_product_id' => $dbProductId,
        'billing_user_id' => null,
        'seller_user_id' => null,
    ]);
});

it('returns a null seller user when the relation has no seller actor', function (): void {
    $client = User::factory()->create();
    $billingUser = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-no-seller',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_user')->insert([
        'db_product_id' => $dbProductId,
        'user_id' => $client->id,
        'attributes' => json_encode(['fact' => $billingUser->id]),
    ]);

    $product = new Product();
    $product->db_products_id = $dbProductId;

    $service = new OrderSnapshotService();
    $method = new ReflectionMethod($service, 'resolveActors');
    $method->setAccessible(true);

    $actors = $method->invoke($service, $client, collect([
        ['product' => $product, 'line_total' => 100.0],
    ]));

    expect($actors)->toBe([
        'db_product_id' => $dbProductId,
        'billing_user_id' => $billingUser->id,
        'seller_user_id' => null,
    ]);
});

it('merges billing profile conditions seller defaults and client overrides in order', function (): void {
    $client = User::factory()->create();
    $billingUser = User::factory()->create();
    $sellerUser = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-conditions-heritage',
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
            'default_profile_id' => 'pro',
            'profiles' => [
                [
                    'id' => 'base',
                    'conditions' => [
                        'shipping' => ['mode' => 'standard', 'fee' => 120],
                        'priority' => 'billing-base',
                        'shared' => ['label' => 'billing-base'],
                    ],
                ],
                [
                    'id' => 'pro',
                    'conditions' => [
                        'shipping' => ['mode' => 'express', 'fee' => 200],
                        'priority' => 'billing-pro',
                        'shared' => ['label' => 'billing-pro'],
                    ],
                ],
            ],
        ]),
        'active' => true,
    ]);

    DB::table('db_product_seller_user')->insert([
        'db_product_id' => $dbProductId,
        'seller_user_id' => $sellerUser->id,
        'billing_user_id' => null,
        'conditions' => json_encode([
            'shipping' => ['fee' => 80],
            'priority' => 'seller',
            'shared' => ['label' => 'seller-default'],
        ]),
        'seller_defaults' => json_encode([
            'shipping' => ['fee' => 70],
            'priority' => 'seller-defaults',
            'shared' => ['label' => 'seller-defaults'],
        ]),
        'use_billing_profile' => true,
        'billing_profile_id' => 'pro',
        'active' => true,
    ]);

    DB::table('client_sales_conditions')->insert([
        'client_user_id' => $client->id,
        'db_product_id' => $dbProductId,
        'billing_user_id' => $billingUser->id,
        'seller_user_id' => $sellerUser->id,
        'conditions_override' => json_encode([
            'shipping' => ['fee' => 50],
            'priority' => 'client',
            'shared' => ['label' => 'client-override'],
        ]),
        'active' => true,
    ]);

    $service = new OrderSnapshotService();
    $method = new ReflectionMethod($service, 'resolveConditionsSnapshot');
    $method->setAccessible(true);

    $snapshot = $method->invoke($service, $dbProductId, $billingUser->id, $sellerUser->id, $client->id);

    expect($snapshot['defaults'])->toBe([
        'default_profile_id' => 'pro',
        'profiles' => [
            [
                'id' => 'base',
                'conditions' => [
                    'shipping' => ['mode' => 'standard', 'fee' => 120],
                    'priority' => 'billing-base',
                    'shared' => ['label' => 'billing-base'],
                ],
            ],
            [
                'id' => 'pro',
                'conditions' => [
                    'shipping' => ['mode' => 'express', 'fee' => 200],
                    'priority' => 'billing-pro',
                    'shared' => ['label' => 'billing-pro'],
                ],
            ],
        ],
    ])
        ->and($snapshot['billing_to_seller_conditions'])->toBe([
            'shipping' => ['mode' => 'express', 'fee' => 200],
            'priority' => 'billing-pro',
            'shared' => ['label' => 'billing-pro'],
        ])
        ->and($snapshot['seller_defaults'])->toBe([
            'shipping' => ['fee' => 70],
            'priority' => 'seller-defaults',
            'shared' => ['label' => 'seller-defaults'],
        ])
        ->and($snapshot['client_override'])->toBe([
            'shipping' => ['fee' => 50],
            'priority' => 'client',
            'shared' => ['label' => 'client-override'],
        ])
        ->and($snapshot['resolved'])->toBe([
            'shipping' => ['mode' => 'express', 'fee' => 50],
            'priority' => 'client',
            'shared' => ['label' => 'client-override'],
        ]);
});

it('inherits billing profile conditions when no seller or client override exists', function (): void {
    $billingUser = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-conditions-simple-heritage',
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
                [
                    'id' => 'base',
                    'conditions' => [
                        'shipping' => ['mode' => 'standard', 'fee' => 120],
                        'priority' => 'billing-base',
                    ],
                ],
            ],
        ]),
        'active' => true,
    ]);

    $service = new OrderSnapshotService();
    $method = new ReflectionMethod($service, 'resolveConditionsSnapshot');
    $method->setAccessible(true);

    $snapshot = $method->invoke($service, $dbProductId, $billingUser->id, null, null);

    expect($snapshot['billing_to_seller_conditions'])->toBe([
        'shipping' => ['mode' => 'standard', 'fee' => 120],
        'priority' => 'billing-base',
    ])
        ->and($snapshot['resolved'])->toBe([
            'shipping' => ['mode' => 'standard', 'fee' => 120],
            'priority' => 'billing-base',
        ])
        ->and($snapshot['seller_defaults'])->toBe([])
        ->and($snapshot['client_override'])->toBe([]);
});

it('selects the default profile and falls back to the first profile when needed', function (): void {
    $service = new OrderSnapshotService();
    $method = new ReflectionMethod($service, 'extractDefaultConditions');
    $method->setAccessible(true);

    $defaultsWithActiveProfile = [
        'default_profile_id' => 'pro',
        'profiles' => [
            [
                'id' => 'base',
                'conditions' => ['priority' => 'base', 'shipping' => ['fee' => 120]],
            ],
            [
                'id' => 'pro',
                'conditions' => ['priority' => 'pro', 'shipping' => ['fee' => 200]],
            ],
        ],
    ];

    $defaultsWithoutMatch = [
        'default_profile_id' => 'missing',
        'profiles' => [
            [
                'id' => 'base',
                'conditions' => ['priority' => 'base', 'shipping' => ['fee' => 120]],
            ],
            [
                'id' => 'pro',
                'conditions' => ['priority' => 'pro', 'shipping' => ['fee' => 200]],
            ],
        ],
    ];

    expect($method->invoke($service, $defaultsWithActiveProfile))->toBe([
        'priority' => 'pro',
        'shipping' => ['fee' => 200],
    ])->and($method->invoke($service, $defaultsWithoutMatch))->toBe([
        'priority' => 'base',
        'shipping' => ['fee' => 120],
    ]);
});

it('returns an empty condition set when no profile exists', function (): void {
    $service = new OrderSnapshotService();
    $method = new ReflectionMethod($service, 'extractDefaultConditions');
    $method->setAccessible(true);

    expect($method->invoke($service, [
        'default_profile_id' => 'missing',
        'profiles' => [],
    ]))->toBe([]);
});

it('applies the active billing profile to the billing-to-seller conditions', function (): void {
    $client = User::factory()->create();
    $billingUser = User::factory()->create();
    $sellerUser = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-active-profile',
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
                [
                    'id' => 'base',
                    'conditions' => ['priority' => 'base', 'shipping' => ['fee' => 120]],
                ],
                [
                    'id' => 'pro',
                    'conditions' => ['priority' => 'pro', 'shipping' => ['fee' => 200]],
                ],
            ],
        ]),
        'active' => true,
    ]);

    DB::table('db_product_seller_user')->insert([
        'db_product_id' => $dbProductId,
        'seller_user_id' => $sellerUser->id,
        'billing_user_id' => null,
        'conditions' => json_encode(['priority' => 'seller', 'shipping' => ['fee' => 80]]),
        'seller_defaults' => json_encode(['priority' => 'seller-defaults', 'shipping' => ['fee' => 70]]),
        'use_billing_profile' => true,
        'billing_profile_id' => 'pro',
        'active' => true,
    ]);

    $service = new OrderSnapshotService();
    $method = new ReflectionMethod($service, 'resolveConditionsSnapshot');
    $method->setAccessible(true);

    $snapshot = $method->invoke($service, $dbProductId, $billingUser->id, $sellerUser->id, $client->id);

    expect($snapshot['billing_to_seller_conditions'])->toBe([
        'priority' => 'pro',
        'shipping' => ['fee' => 200],
    ])
        ->and($snapshot['seller_defaults'])->toBe([
            'priority' => 'seller-defaults',
            'shipping' => ['fee' => 70],
        ])
        ->and($snapshot['resolved'])->toBe([
            'priority' => 'seller-defaults',
            'shipping' => ['fee' => 70],
        ]);
});

it('falls back to direct seller conditions when the billing profile is disabled', function (): void {
    $client = User::factory()->create();
    $billingUser = User::factory()->create();
    $sellerUser = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-disabled-billing-profile',
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
                [
                    'id' => 'base',
                    'conditions' => ['priority' => 'base', 'shipping' => ['fee' => 120]],
                ],
                [
                    'id' => 'pro',
                    'conditions' => ['priority' => 'pro', 'shipping' => ['fee' => 200]],
                ],
            ],
        ]),
        'active' => true,
    ]);

    DB::table('db_product_seller_user')->insert([
        'db_product_id' => $dbProductId,
        'seller_user_id' => $sellerUser->id,
        'billing_user_id' => null,
        'conditions' => json_encode(['priority' => 'seller-direct', 'shipping' => ['fee' => 95]]),
        'seller_defaults' => json_encode(['priority' => 'seller-defaults', 'shipping' => ['fee' => 70]]),
        'use_billing_profile' => false,
        'billing_profile_id' => 'pro',
        'active' => true,
    ]);

    $service = new OrderSnapshotService();
    $method = new ReflectionMethod($service, 'resolveConditionsSnapshot');
    $method->setAccessible(true);

    $snapshot = $method->invoke($service, $dbProductId, $billingUser->id, $sellerUser->id, $client->id);

    expect($snapshot['billing_to_seller_conditions'])->toBe([
        'priority' => 'seller-direct',
        'shipping' => ['fee' => 95],
    ])
        ->and($snapshot['seller_defaults'])->toBe([
            'priority' => 'seller-defaults',
            'shipping' => ['fee' => 70],
        ])
        ->and($snapshot['resolved'])->toBe([
            'priority' => 'seller-defaults',
            'shipping' => ['fee' => 70],
        ]);
});

it('applies the client override on top of relation conditions', function (): void {
    $client = User::factory()->create();
    $billingUser = User::factory()->create();
    $sellerUser = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-client-override',
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
                [
                    'id' => 'base',
                    'conditions' => ['priority' => 'base', 'shipping' => ['fee' => 120]],
                ],
            ],
        ]),
        'active' => true,
    ]);

    DB::table('db_product_seller_user')->insert([
        'db_product_id' => $dbProductId,
        'seller_user_id' => $sellerUser->id,
        'billing_user_id' => null,
        'conditions' => json_encode(['priority' => 'seller', 'shipping' => ['fee' => 80]]),
        'seller_defaults' => json_encode(['priority' => 'seller-defaults', 'shipping' => ['fee' => 70]]),
        'use_billing_profile' => true,
        'billing_profile_id' => 'base',
        'active' => true,
    ]);

    DB::table('client_sales_conditions')->insert([
        'client_user_id' => $client->id,
        'db_product_id' => $dbProductId,
        'billing_user_id' => $billingUser->id,
        'seller_user_id' => $sellerUser->id,
        'conditions_override' => json_encode([
            'priority' => 'client',
            'shipping' => ['fee' => 30],
        ]),
        'active' => true,
    ]);

    $service = new OrderSnapshotService();
    $method = new ReflectionMethod($service, 'resolveConditionsSnapshot');
    $method->setAccessible(true);

    $snapshot = $method->invoke($service, $dbProductId, $billingUser->id, $sellerUser->id, $client->id);

    expect($snapshot['resolved'])->toBe([
        'priority' => 'client',
        'shipping' => ['fee' => 30],
    ]);
});
