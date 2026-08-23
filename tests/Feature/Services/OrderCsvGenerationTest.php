<?php

use App\Models\Cart;
use App\Models\DbProductBillingUser;
use App\Models\DbProducts;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderCsvService;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

it('persists billing profiles and CSV files together', function (): void {
    $admin = User::factory()->withoutTwoFactor()->create();
    $admin->assignRole(Role::findOrCreate('admin', 'web'));

    $billingUser = User::factory()->withoutTwoFactor()->create();
    $database = DbProducts::query()->create([
        'name' => 'Profils et fichiers',
        'description' => 'Persistence test',
    ]);

    $defaults = [
        'default_profile_id' => 'grossiste',
        'profiles' => [[
            'id' => 'grossiste',
            'name' => 'Grossiste',
            'conditions' => ['discount' => '12'],
        ]],
        'files' => [[
            'id' => 'order-csv',
            'name' => 'Commande CSV',
            'event' => 'order',
            'enabled' => true,
            'delimiter' => ';',
            'system' => true,
            'blocks' => [[
                'id' => 'items',
                'name' => 'Liste des produits',
                'type' => 'items',
                'enabled' => true,
                'show_headers' => true,
                'columns' => [['id' => 'reference', 'name' => 'Reference']],
                'rows' => [[
                    'id' => 'item-row',
                    'cells' => ['reference' => '%product.reference%'],
                ]],
            ]],
        ]],
    ];

    $response = $this->actingAs($admin)->put(
        route('db-products.update-billing', $database),
        ['billing_users' => [[
            'billing_user_id' => $billingUser->id,
            'defaults' => $defaults,
            'sellers' => [],
        ]]],
    );

    $response->assertRedirect(route('db-products.billing', $database));

    $stored = DbProductBillingUser::query()
        ->where('db_product_id', $database->id)
        ->where('billing_user_id', $billingUser->id)
        ->firstOrFail();

    expect($stored->defaults['default_profile_id'])->toBe('grossiste')
        ->and($stored->defaults['profiles'])->toEqual($defaults['profiles'])
        ->and($stored->defaults['files'])->toEqual($defaults['files']);
});

it('stores enabled order CSV templates for the configured billing user', function (): void {
    Storage::fake('local');

    $client = User::factory()->create();
    $billingUser = User::factory()->create();
    $database = DbProducts::query()->create([
        'name' => 'Fleurs France',
        'description' => 'CSV test',
    ]);
    $cart = Cart::query()->create([
        'user_id' => $client->id,
        'status' => 'processing',
    ]);

    DbProductBillingUser::query()->create([
        'db_product_id' => $database->id,
        'billing_user_id' => $billingUser->id,
        'active' => true,
        'defaults' => [
            'files' => [
                [
                    'id' => 'order-csv',
                    'name' => 'Commande CSV',
                    'event' => 'order',
                    'enabled' => true,
                    'delimiter' => ';',
                    'scope' => 'items',
                    'columns' => [['id' => 'reference', 'name' => 'Reference']],
                    'rows' => [[
                        'id' => 'item-row',
                        'cells' => ['reference' => '%product.reference%'],
                    ]],
                ],
                [
                    'id' => 'delivery-csv',
                    'name' => 'Livraison CSV',
                    'event' => 'delivery',
                    'enabled' => true,
                    'delimiter' => ';',
                    'scope' => 'document',
                    'columns' => [['id' => 'number', 'name' => 'Numero']],
                    'rows' => [[
                        'id' => 'document-row',
                        'cells' => ['number' => '%delivery.number%'],
                    ]],
                ],
            ],
        ],
    ]);

    $product = new Product([
        'db_products_id' => $database->id,
        'ref' => 'TUL-01',
        'name' => 'Tulipe',
    ]);

    $files = app(OrderCsvService::class)->generate($cart, $client, [
        'order_number' => '00012',
        'items' => collect([[
            'product' => $product,
            'quantity' => 2,
            'unit_price' => 3,
            'line_total' => 6,
        ]]),
        'billing_context_by_db' => [
            $database->id => ['billing_user_id' => $billingUser->id],
        ],
    ]);

    $service = app(OrderCsvService::class);

    expect($files)->toHaveCount(1)
        ->and($files[0]['filename'])->toContain('commande-csv')
        ->and($files[0]['billing_user_id'])->toBe($billingUser->id)
        ->and($files[0]['event'])->toBe('order')
        ->and($files[0]['disk'])->toBe('local')
        ->and($service->attachmentPathsForBillingUser($files, $billingUser->id))->toBe([
            $files[0]['relative_path'],
        ])
        ->and($service->attachmentPathsForBillingUser($files, $client->id))->toBe([])
        ->and($service->attachmentPathsForRecipient([
            [...$files[0], 'billing_user_id' => $client->id],
        ], $client->id, $client->id))->toBe([])
        ->and($billingUser->files()->where('file_path', $files[0]['relative_path'])->exists())->toBeTrue()
        ->and($client->files()->where('file_path', $files[0]['relative_path'])->exists())->toBeFalse();

    Storage::disk('local')->assertExists($files[0]['relative_path']);
    expect(Storage::disk('local')->get($files[0]['relative_path']))->toContain('TUL-01');

    $deliveryFiles = $service->generateForEvent('delivery', $cart, $client, [
        'document_number' => 'BL-00012',
        'items' => collect([[
            'product' => $product,
            'quantity' => 2,
            'unit_price' => 3,
            'line_total' => 6,
        ]]),
        'billing_context_by_db' => [
            $database->id => ['billing_user_id' => $billingUser->id],
        ],
    ]);

    expect($deliveryFiles)->toHaveCount(1)
        ->and($deliveryFiles[0]['event'])->toBe('delivery')
        ->and(Storage::disk('local')->get($deliveryFiles[0]['relative_path']))->toContain('BL-00012');
});
