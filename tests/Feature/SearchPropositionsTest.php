<?php

use App\Models\CategoryProducts;
use App\Models\Product;

it('returns matching product categories before product suggestions', function () {
    $root = CategoryProducts::create(['name' => 'Catalogue']);
    $category = CategoryProducts::create(['name' => 'Rosiers anciens']);
    $category->appendToNode($root)->save();

    Product::create([
        'sku' => 'ROSIER-1',
        'ref' => 'ROSIER-1',
        'ean13' => '1234567890123',
        'name' => 'Rosier grimpant',
        'active' => true,
        'category_products_id' => $category->id,
    ]);

    $response = $this->getJson(route('search.propositions', [
        'context' => 'products',
        'q' => 'rosier',
        'limit' => 10,
    ]));

    $response
        ->assertOk()
        ->assertJsonPath('propositions.0', [
            'value' => 'category:' . $category->id,
            'label' => 'Rosiers anciens',
            'badge' => 'cat',
            'kind' => 'category',
            'id' => $category->id,
        ])
        ->assertJsonPath('propositions.1', 'rosier grimpant');
});

it('only suggests available products and categories matching the current filters', function () {
    CategoryProducts::create(['name' => 'Catalogue']);
    $validCategory = CategoryProducts::create(['name' => 'Pyramides disponibles']);
    $invalidCategory = CategoryProducts::create(['name' => 'Pyramides indisponibles']);

    foreach ([
        ['name' => 'Taxus pyramide', 'active' => true, 'pot' => '20', 'category_products_id' => $validCategory->id],
        ['name' => 'Buxus pyramide', 'active' => false, 'pot' => '20', 'category_products_id' => $invalidCategory->id],
        ['name' => 'Ilex pyramide', 'active' => true, 'pot' => '30', 'category_products_id' => $invalidCategory->id],
        ['name' => 'Thuya pyramide', 'active' => true, 'pot' => '20', 'available_until' => now()->subDay(), 'category_products_id' => $invalidCategory->id],
    ] as $index => $attributes) {
        Product::create(array_merge([
            'sku' => 'PYRAMIDE-'.$index,
            'ref' => 'PYRAMIDE-'.$index,
            'ean13' => '123456789012'.$index,
        ], $attributes));
    }

    $response = $this->getJson(route('search.propositions', [
        'context' => 'products',
        'q' => 'pyramide',
        'active' => 1,
        'pot' => ['20'],
    ]));

    $response->assertOk()->assertJsonCount(2, 'propositions')
        ->assertJsonPath('propositions.0.id', $validCategory->id)
        ->assertJsonPath('propositions.1', 'taxus pyramide');

    $this->getJson(route('search.propositions', [
        'context' => 'products',
        'q' => 'pyramide',
        'pot' => ['20'],
    ]))->assertOk()->assertExactJson($response->json());

    $this->withSession(['cart_filter_ids' => []])->getJson(route('search.propositions', [
        'context' => 'products',
        'q' => 'pyramide',
        'cart' => '1',
    ]))->assertOk()->assertExactJson(['propositions' => []]);

    $this->actingAs(\App\Models\User::factory()->create())->getJson(route('search.propositions', [
        'context' => 'products',
        'q' => 'pyramide',
    ]))->assertOk()->assertExactJson(['propositions' => []]);
});
