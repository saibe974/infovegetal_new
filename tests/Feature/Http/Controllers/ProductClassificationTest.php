<?php

use App\Models\CategoryProducts;
use App\Models\Product;
use App\Models\Tag;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $admin = User::factory()->withoutTwoFactor()->create();
    $admin->assignRole(Role::findOrCreate('admin', 'web'));
    $this->actingAs($admin);
    $this->product = Product::create([
        'name' => 'Taxus pyramide',
        'sku' => 'TAXUS-1',
        'ref' => 'TAXUS-1',
        'ean13' => '1234567890123',
        'active' => true,
    ]);
});

it('provides the category hierarchy and existing tags in the editor', function () {
    $parent = CategoryProducts::create(['name' => 'Conifères']);
    $child = CategoryProducts::create(['name' => 'Taxus']);
    $child->appendToNode($parent)->save();
    Tag::create(['name' => 'Pyramide', 'slug' => 'pyramide']);

    $this->get(route('products.admin.edit', $this->product))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('products/form')
            ->has('categories', 2)
            ->where('categories.1.parent_id', $parent->id)
            ->where('tagOptions.0', 'Pyramide'));
});

it('saves one category and reuses existing tags while creating multiword tags', function () {
    $category = CategoryProducts::create(['name' => 'Taxus']);
    $existing = Tag::create(['name' => 'Pyramide', 'slug' => 'pyramide']);
    $payload = [
        'name' => $this->product->name,
        'sku' => $this->product->sku,
        'category_products_id' => $category->id,
        'tags' => ['Pyramide', 'Feuillage persistant', 'pyramide'],
    ];

    $this->put(route('products.admin.update', $this->product), $payload)->assertSessionHasNoErrors();

    expect($this->product->fresh()->category_products_id)->toBe($category->id)
        ->and($this->product->tags()->count())->toBe(2)
        ->and($this->product->tags()->whereKey($existing->id)->exists())->toBeTrue();
    $this->assertDatabaseHas('tags', ['name' => 'Feuillage persistant', 'slug' => 'feuillage-persistant']);

    $this->put(route('products.admin.update', $this->product), array_replace($payload, [
        'category_products_id' => null,
        'tags' => [],
    ]))->assertSessionHasNoErrors();

    expect($this->product->fresh()->category_products_id)->toBeNull()
        ->and($this->product->tags()->count())->toBe(0);
    $this->assertDatabaseHas('tags', ['id' => $existing->id]);
});

it('rejects unknown categories and invalid tags', function () {
    $this->put(route('products.admin.update', $this->product), [
        'name' => $this->product->name,
        'sku' => $this->product->sku,
        'category_products_id' => 999999,
        'tags' => [str_repeat('a', 256), '---'],
    ])->assertSessionHasErrors(['category_products_id', 'tags.0', 'tags.1']);
});
