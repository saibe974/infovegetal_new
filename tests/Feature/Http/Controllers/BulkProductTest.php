<?php

use App\Models\CategoryProducts;
use App\Models\Product;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->admin = User::factory()->withoutTwoFactor()->create();
    $this->admin->assignRole(Role::findOrCreate('admin', 'web'));
    $this->actingAs($this->admin);
});

function bulkProductSelection($test, array $filters = []): string
{
    $response = $test->get(route('products.admin.bulk-edit', $filters));
    $response->assertOk();

    return $response->original->getData()['page']['props']['selection'];
}

function bulkProduct(string $sku, array $attributes = []): Product
{
    return Product::create(array_merge(['name' => 'Taxus test', 'sku' => $sku, 'ref' => $sku, 'ean13' => '', 'active' => true], $attributes));
}

it('edits every filtered page using a frozen selection even when changing filtered fields', function () {
    $parent = CategoryProducts::create(['name' => 'Parent']);
    $child = CategoryProducts::create(['name' => 'Enfant']);
    $child->appendToNode($parent)->save();
    $target = CategoryProducts::create(['name' => 'Destination']);
    $matches = collect(range(1, 27))->map(fn ($i) => bulkProduct("match-{$i}", [
        'category_products_id' => $child->id, 'pot' => 12, 'height' => '40',
    ]));
    $excluded = bulkProduct('excluded', ['pot' => 18, 'category_products_id' => $child->id]);
    $inactive = bulkProduct('inactive', ['active' => false, 'pot' => 12, 'category_products_id' => $child->id]);
    $filters = ['q' => 'Taxus', 'category' => $parent->id, 'pot' => ['12', '14'], 'height' => ['40'], 'page' => 2];
    $selection = bulkProductSelection($this, $filters);
    // A later matching product must not silently join the reviewed selection.
    $later = bulkProduct('later', ['category_products_id' => $child->id, 'pot' => 12, 'height' => '40']);

    $this->put(route('products.admin.bulk-update'), [
        'selection' => $selection, 'changes' => ['category_products_id' => $target->id, 'pot' => 20], 'tags_mode' => 'keep',
    ])->assertSessionHasNoErrors()->assertRedirect(route('products.index', array_diff_key($filters, ['page' => true])));

    expect(Product::whereIn('id', $matches->pluck('id'))->where('category_products_id', $target->id)->count())->toBe(27)
        ->and($excluded->fresh()->category_products_id)->toBe($child->id)
        ->and($inactive->fresh()->category_products_id)->toBe($child->id)
        ->and($later->fresh()->category_products_id)->toBe($child->id)
        ->and($matches->first()->fresh()->name)->toBe('Taxus test');
});

it('adds tags without replacing existing tags and removes only chosen tags', function () {
    $product = bulkProduct('tagged');
    $existing = Tag::create(['name' => 'Persistant', 'slug' => 'persistant']);
    $product->tags()->attach($existing);
    $this->put(route('products.admin.bulk-update'), [
        'selection' => bulkProductSelection($this), 'changes' => [], 'tags_mode' => 'add',
        'tags' => ['Pyramide', 'pyramide', 'Persistant'],
    ])->assertSessionHasNoErrors();
    expect($product->tags()->count())->toBe(2);

    $this->put(route('products.admin.bulk-update'), [
        'selection' => bulkProductSelection($this), 'changes' => [], 'tags_mode' => 'remove',
        'tags' => ['pyramide', 'Inexistant'],
    ])->assertSessionHasNoErrors();
    expect($product->tags()->pluck('tags.id')->all())->toBe([$existing->id]);
    $this->assertDatabaseMissing('tags', ['slug' => 'inexistant']);
    $this->assertDatabaseHas('tags', ['slug' => 'pyramide']);
});

it('clears nullable fields and leaves tags unchanged by default', function () {
    $category = CategoryProducts::create(['name' => 'Taxus']);
    $product = bulkProduct('clear', ['category_products_id' => $category->id, 'description' => 'Texte']);
    $tag = Tag::create(['name' => 'Persistant', 'slug' => 'persistant']);
    $product->tags()->attach($tag);
    $this->put(route('products.admin.bulk-update'), [
        'selection' => bulkProductSelection($this),
        'changes' => ['category_products_id' => null, 'description' => null, 'active' => false],
        'tags_mode' => 'keep', 'tags' => ['Ignoré'],
    ])->assertSessionHasNoErrors();
    expect($product->fresh()->category_products_id)->toBeNull()
        ->and($product->fresh()->description)->toBeNull()
        ->and($product->fresh()->active)->toBeFalse()
        ->and($product->tags()->pluck('tags.id')->all())->toBe([$tag->id]);
});

it('validates changes before writing and rolls back invalid resulting availability', function () {
    $first = bulkProduct('first', ['available_from' => '2026-01-01', 'available_until' => '2026-12-01']);
    $second = bulkProduct('second', ['available_from' => '2026-06-01', 'available_until' => '2026-12-01']);
    $selection = bulkProductSelection($this);
    $this->put(route('products.admin.bulk-update'), [
        'selection' => $selection, 'changes' => ['name' => 'Nouveau', 'available_until' => '2026-03-01'], 'tags_mode' => 'keep',
    ])->assertSessionHasErrors('changes.available_until');
    expect($first->fresh()->name)->toBe('Taxus test')->and($second->fresh()->name)->toBe('Taxus test');

    $this->put(route('products.admin.bulk-update'), [
        'selection' => $selection, 'changes' => ['category_products_id' => 999999, 'price' => -1],
        'tags_mode' => 'add', 'tags' => ['---'],
    ])->assertSessionHasErrors(['changes.category_products_id', 'changes.price', 'tags.0']);
    $this->put(route('products.admin.bulk-update'), [
        'selection' => $selection, 'changes' => [], 'tags_mode' => 'keep',
    ])->assertSessionHasErrors('changes');
    $this->put(route('products.admin.bulk-update'), [
        'selection' => $selection, 'changes' => ['sku' => 'duplicate'], 'tags_mode' => 'keep',
    ])->assertSessionHasErrors('changes');
});

it('rejects empty, expired and other users selections', function () {
    $empty = bulkProductSelection($this);
    $this->put(route('products.admin.bulk-update'), [
        'selection' => $empty, 'changes' => ['active' => false], 'tags_mode' => 'keep',
    ])->assertSessionHasErrors('selection');
    bulkProduct('secure');
    $selection = bulkProductSelection($this);
    $other = User::factory()->withoutTwoFactor()->create();
    $other->assignRole('admin');
    $payload = ['selection' => $selection, 'changes' => ['active' => false], 'tags_mode' => 'keep'];
    $this->actingAs($other)->put(route('products.admin.bulk-update'), $payload)->assertSessionHasErrors('selection');
    Cache::forget('products:bulk:'.$selection);
    $this->actingAs($this->admin)->put(route('products.admin.bulk-update'), $payload)->assertSessionHasErrors('selection');
});

it('protects both bulk endpoints with admin authorization', function () {
    $user = User::factory()->withoutTwoFactor()->create();
    $this->actingAs($user)->get(route('products.admin.bulk-edit'))->assertForbidden();
    $this->put(route('products.admin.bulk-update'), [])->assertForbidden();
});

it('preserves cart and inactive filters and provides taxonomy options', function () {
    $product = bulkProduct('cart-inactive', ['active' => false]);
    bulkProduct('outside-cart');
    CategoryProducts::create(['name' => 'Taxus']);
    Tag::create(['name' => 'Persistant', 'slug' => 'persistant']);
    $this->withSession(['cart_filter_ids' => [$product->id]])
        ->get(route('products.admin.bulk-edit', ['cart' => '1', 'active' => '0']))
        ->assertInertia(fn (Assert $page) => $page->component('products/bulk-edit')
            ->where('total', 1)->has('categories', 1)->where('tagOptions.0', 'Persistant')
            ->where('filterSummary', [
                ['label' => 'Statut', 'value' => 'Inactifs'],
                ['label' => 'Panier', 'value' => 'Produits du panier'],
            ]));
});
