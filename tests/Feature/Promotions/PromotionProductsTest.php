<?php

use App\Models\DbProducts;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

function promotionProductsUser(string $roleName = 'admin'): User
{
    $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
    $user = User::factory()->withoutTwoFactor()->create();
    $user->assignRole($role);

    return $user;
}

function promotionProductsPromotion(User $owner): Promotion
{
    return Promotion::create([
        'title' => 'Sélection produits',
        'slug' => 'selection-produits-'.fake()->unique()->numberBetween(1, 999999),
        'status' => 'draft',
        'visibility' => 'targeted',
        'created_by_id' => $owner->id,
        'responsible_user_id' => $owner->id,
    ]);
}

function promotionProductsProduct(array $attributes = []): Product
{
    $token = fake()->unique()->numerify('######');

    return Product::create(array_merge([
        'name' => 'Produit '.$token,
        'sku' => 'SKU-'.$token,
        'ref' => 'REF-'.$token,
        'ean13' => str_pad($token, 13, '0'),
        'price' => 10,
        'active' => true,
    ], $attributes));
}

test('an upcoming product can be selected and configured for preview', function () {
    $this->travelTo(CarbonImmutable::parse('2026-09-01 10:00:00'));
    $admin = promotionProductsUser();
    $promotion = promotionProductsPromotion($admin);
    $product = promotionProductsProduct([
        'name' => 'Rosier en avant-première',
        'available_from' => now()->addWeek(),
    ]);

    $this->actingAs($admin)
        ->put(route('promotions.products.update', $promotion, false), [
            'products' => [[
                'id' => $product->id,
                'featured' => true,
                'show_before_availability' => true,
                'custom_title' => 'Découvrez-le avant tout le monde',
                'custom_description' => 'Disponible la semaine prochaine.',
            ]],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $this->assertDatabaseHas('promotion_product', [
        'promotion_id' => $promotion->id,
        'product_id' => $product->id,
        'position' => 0,
        'featured' => true,
        'show_before_availability' => true,
        'custom_title' => 'Découvrez-le avant tout le monde',
    ]);

    $this->actingAs($admin)
        ->get(route('promotions.edit.products', $promotion, false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('promotions/products')
            ->where('selectedProducts.0.id', $product->id)
            ->where('selectedProducts.0.availability_status', 'upcoming')
            ->where('selectedProducts.0.show_before_availability', true));
});

test('saving the selection persists its explicit order', function () {
    $admin = promotionProductsUser();
    $promotion = promotionProductsPromotion($admin);
    $first = promotionProductsProduct(['name' => 'Premier']);
    $second = promotionProductsProduct(['name' => 'Second']);

    $this->actingAs($admin)
        ->put(route('promotions.products.update', $promotion, false), [
            'products' => [
                [
                    'id' => $second->id,
                    'featured' => false,
                    'show_before_availability' => false,
                    'custom_title' => null,
                    'custom_description' => null,
                ],
                [
                    'id' => $first->id,
                    'featured' => false,
                    'show_before_availability' => false,
                    'custom_title' => null,
                    'custom_description' => null,
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    expect($promotion->products()->pluck('products.id')->all())->toBe([$second->id, $first->id]);
});

test('a manager can select only products from an accessible database', function () {
    $permission = Permission::firstOrCreate(['name' => 'promo.manage', 'guard_name' => 'web']);
    $manager = User::factory()->withoutTwoFactor()->create();
    $manager->givePermissionTo($permission);
    $promotion = promotionProductsPromotion($manager);
    $allowedDatabase = DbProducts::create(['name' => 'Base autorisée']);
    $forbiddenDatabase = DbProducts::create(['name' => 'Base interdite']);
    $manager->dbProducts()->attach($allowedDatabase->id, [
        'can_access' => true,
        'can_buy' => true,
        'can_invoice' => false,
        'can_sell' => false,
        'can_manage' => false,
    ]);
    $allowed = promotionProductsProduct(['db_products_id' => $allowedDatabase->id]);
    $forbidden = promotionProductsProduct(['db_products_id' => $forbiddenDatabase->id]);

    $this->actingAs($manager)
        ->get(route('promotions.edit.products', $promotion, false))
        ->assertInertia(fn (Assert $page) => $page
            ->has('productOptions.data', 1)
            ->where('productOptions.data.0.id', $allowed->id)
            ->where('productOptions.meta.total', 1)
            ->where('productOptions.meta.current_page', 1)
            ->where('productOptions.links.prev', null)
            ->where('productOptions.links.next', null));

    $this->actingAs($manager)
        ->put(route('promotions.products.update', $promotion, false), [
            'products' => [[
                'id' => $forbidden->id,
                'featured' => false,
                'show_before_availability' => false,
                'custom_title' => null,
                'custom_description' => null,
            ]],
        ])
        ->assertSessionHasErrors('products');

    expect(DB::table('promotion_product')->count())->toBe(0);
});

test('selecting every filtered product is capped', function () {
    $admin = promotionProductsUser();
    $promotion = promotionProductsPromotion($admin);

    for ($i = 0; $i <= Promotion::MAX_SELECTED_PRODUCTS; $i++) {
        promotionProductsProduct();
    }

    $this->actingAs($admin)
        ->get(route('promotions.products.selectable', $promotion, false))
        ->assertStatus(422)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'affinez'));

    promotionProductsProduct([
        'name' => 'Rosier unique',
        'sku' => 'SKU-ROSIER',
        'ref' => 'REF-ROSIER',
    ]);

    $this->actingAs($admin)
        ->get(route('promotions.products.selectable', $promotion, false).'?q='.urlencode('Rosier'))
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonCount(1, 'products')
        ->assertJsonPath('products.0.name', 'Rosier unique');
});

test('a selection cannot exceed the maximum number of products', function () {
    $admin = promotionProductsUser();
    $promotion = promotionProductsPromotion($admin);

    $products = collect(range(0, Promotion::MAX_SELECTED_PRODUCTS))
        ->map(fn () => promotionProductsProduct());

    $this->actingAs($admin)
        ->put(route('promotions.products.update', $promotion, false), [
            'products' => $products->map(fn (Product $product) => [
                'id' => $product->id,
                'featured' => false,
                'show_before_availability' => false,
                'custom_title' => null,
                'custom_description' => null,
            ])->all(),
        ])
        ->assertSessionHasErrors('products');

    expect(DB::table('promotion_product')->count())->toBe(0);
});

test('the promotion catalog honors the product filters', function () {
    $admin = promotionProductsUser();
    $promotion = promotionProductsPromotion($admin);

    $frenchDatabase = DbProducts::create(['name' => 'Base FR', 'country' => 'FR']);
    $dutchDatabase = DbProducts::create(['name' => 'Base NL', 'country' => 'NL']);

    $promoProduct = promotionProductsProduct([
        'name' => 'Rosier promo',
        'db_products_id' => $frenchDatabase->id,
        'pot' => '17',
        'price' => 10,
        'price_promo' => 8,
        'img_link' => 'https://example.com/rosier.jpg',
    ]);
    $plainProduct = promotionProductsProduct([
        'name' => 'Hortensia simple',
        'db_products_id' => $dutchDatabase->id,
        'pot' => '19',
        'height' => '40',
        'price' => 12,
    ]);

    $this->actingAs($admin)
        ->get(route('promotions.edit.products', $promotion, false).'?'.http_build_query(['pot' => ['17']]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('productOptions.data', 1)
            ->where('productOptions.data.0.id', $promoProduct->id)
            ->has('potOptions', 2));

    $this->actingAs($admin)
        ->get(route('promotions.edit.products', $promotion, false).'?promo=1')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('productOptions.data', 1)
            ->where('productOptions.data.0.id', $promoProduct->id)
            ->where('filters.promo', true));

    $this->actingAs($admin)
        ->get(route('promotions.edit.products', $promotion, false).'?image=without')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('productOptions.data', 1)
            ->where('productOptions.data.0.id', $plainProduct->id));

    $this->actingAs($admin)
        ->get(route('promotions.edit.products', $promotion, false).'?'.http_build_query(['country' => ['FR']]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('productOptions.data', 1)
            ->where('productOptions.data.0.id', $promoProduct->id)
            ->has('countryOptions', 2)
            ->where('countryOptions.0', 'FR'));
});

test('an inactive product cannot be newly selected', function () {
    $admin = promotionProductsUser();
    $promotion = promotionProductsPromotion($admin);
    $inactive = promotionProductsProduct(['active' => false]);

    $this->actingAs($admin)
        ->put(route('promotions.products.update', $promotion, false), [
            'products' => [[
                'id' => $inactive->id,
                'featured' => false,
                'show_before_availability' => false,
                'custom_title' => null,
                'custom_description' => null,
            ]],
        ])
        ->assertSessionHasErrors('products');
});

test('product availability dates determine whether it is orderable', function () {
    $this->travelTo(CarbonImmutable::parse('2026-09-10 12:00:00'));
    $available = promotionProductsProduct([
        'available_from' => now()->subDay(),
        'available_until' => now()->addDay(),
    ]);
    $upcoming = promotionProductsProduct(['available_from' => now()->addMinute()]);
    $ended = promotionProductsProduct(['available_until' => now()->subMinute()]);

    expect($available->isOrderableAt())->toBeTrue()
        ->and($available->availabilityStatusAt())->toBe('available')
        ->and($upcoming->isOrderableAt())->toBeFalse()
        ->and($upcoming->availabilityStatusAt())->toBe('upcoming')
        ->and($ended->isOrderableAt())->toBeFalse()
        ->and($ended->availabilityStatusAt())->toBe('ended')
        ->and(Product::query()->orderableAt()->pluck('id')->all())->toBe([$available->id]);
});

test('an upcoming product cannot be added to the cart before its date', function () {
    $this->travelTo(CarbonImmutable::parse('2026-09-10 12:00:00'));
    $client = promotionProductsUser('client');
    $upcoming = promotionProductsProduct(['available_from' => now()->addDay()]);

    $this->actingAs($client)
        ->postJson(route('cart.add', [], false), [
            'product_id' => $upcoming->id,
            'quantity' => 1,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('product_id');

    $this->travelTo(now()->addDays(2));

    $this->actingAs($client)
        ->postJson(route('cart.add', [], false), [
            'product_id' => $upcoming->id,
            'quantity' => 1,
        ])
        ->assertOk();
});

test('the regular catalog hides upcoming products while an admin can manage them', function () {
    $this->travelTo(CarbonImmutable::parse('2026-09-10 12:00:00'));
    $available = promotionProductsProduct(['name' => 'Disponible maintenant']);
    $upcoming = promotionProductsProduct([
        'name' => 'Disponible bientôt',
        'available_from' => now()->addDay(),
    ]);

    $this->get(route('products.index', [], false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('collection.data', 1)
            ->where('collection.data.0.id', $available->id));

    $this->get(route('products.show', $upcoming, false))->assertNotFound();

    $admin = promotionProductsUser();

    $this->actingAs($admin)
        ->get(route('products.admin.index', [], false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('collection.data', 2));

    $this->actingAs($admin)
        ->get(route('products.show', $upcoming, false))
        ->assertOk();
});

test('product availability end must be later than its start', function () {
    $admin = promotionProductsUser();
    $product = promotionProductsProduct();

    $this->actingAs($admin)
        ->put(route('products.admin.update', $product, false), [
            'name' => $product->name,
            'sku' => $product->sku,
            'ref' => $product->ref,
            'ean13' => $product->ean13,
            'available_from' => '2026-10-10 12:00:00',
            'available_until' => '2026-10-01 12:00:00',
        ])
        ->assertSessionHasErrors('available_until');
});
