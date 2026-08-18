<?php

use App\Services\ProductImportService;

function resolveProductImportUpdateColumns(?array $fields, ?string $traitement): array
{
    $service = app(ProductImportService::class);
    $method = new ReflectionMethod($service, 'resolveProductUpdateColumns');

    return $method->invoke($service, $fields, $traitement);
}

test('legacy import configurations retain their previous update policy', function () {
    expect(resolveProductImportUpdateColumns(null, null))
        ->toContain('price', 'category_products_id')
        ->and(resolveProductImportUpdateColumns(null, 'infovegetal_old'))
        ->toBe(['name', 'description', 'category_products_id', 'img_link']);
});

test('configured imports only overwrite selected product data', function () {
    expect(resolveProductImportUpdateColumns(['price'], null))
        ->toBe(['price', 'active', 'db_products_id'])
        ->not->toContain('category_products_id');
});

test('computed mapping targets update their persisted product columns', function () {
    expect(resolveProductImportUpdateColumns([
        'category_products_name',
        'prix_etage',
        'prix_roll',
        'prix_promo',
        'haut',
    ], 'peplant'))->toBe([
        'category_products_id',
        'height',
        'price_floor',
        'price_roll',
        'price_promo',
        'active',
        'db_products_id',
    ]);
});

test('an empty selection only updates importer lifecycle fields', function () {
    expect(resolveProductImportUpdateColumns([], null))
        ->toBe(['active', 'db_products_id']);
});

test('block category updates can be enabled independently from column mappings', function () {
    expect(resolveProductImportUpdateColumns(['category_products_id'], 'ddk'))
        ->toBe(['category_products_id', 'active', 'db_products_id'])
        ->and(resolveProductImportUpdateColumns([], 'ddk'))
        ->not->toContain('category_products_id');
});
