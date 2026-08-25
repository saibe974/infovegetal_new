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
