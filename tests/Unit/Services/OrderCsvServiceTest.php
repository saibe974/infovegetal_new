<?php

use App\Models\Product;
use App\Services\OrderCsvService;

it('renders an item CSV with headers literals and percent variables', function (): void {
    $product = new Product([
        'ref' => 'ROS-42',
        'sku' => 'SKU-42',
        'name' => 'Rose rouge',
        'description' => 'Rose rouge à longue tige',
        'cond' => 10,
        'floor' => 5,
        'roll' => 4,
        'pot' => 14.5,
        'height' => '40-60 cm',
    ]);

    $csv = (new OrderCsvService)->render([
        'delimiter' => ';',
        'scope' => 'items',
        'columns' => [
            ['id' => 'reference', 'name' => 'Reference'],
            ['id' => 'label', 'name' => 'Libelle'],
            ['id' => 'quantity', 'name' => 'Quantite'],
            ['id' => 'total', 'name' => 'Total'],
            ['id' => 'packing', 'name' => 'Conditionnement'],
            ['id' => 'calculation', 'name' => 'Calcul'],
            ['id' => 'dimensions', 'name' => 'Dimensions'],
            ['id' => 'description', 'name' => 'Description'],
        ],
        'rows' => [[
            'id' => 'item-row',
            'cells' => [
                'reference' => '%product.reference%',
                'label' => 'Commande %order.number% - %product.name%',
                'quantity' => '%quantity%',
                'total' => '%line_total%',
                'packing' => '%product.cond%*%product.floor%*%product.roll%',
                'calculation' => '%calc:product.cond*product.floor*product.roll|decimal:2%',
                'dimensions' => '%product.pot% / %product.height%',
                'description' => '%product.description%',
            ],
        ]],
    ], collect([[
        'product' => $product,
        'quantity' => 3,
        'unit_price' => 2.5,
        'line_total' => 7.5,
        'comment' => '',
    ]]), [
        'order' => ['number' => '00042'],
    ]);

    $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv);
    $lines = array_values(array_filter(explode("\n", trim((string) $csv))));

    expect(str_getcsv($lines[0], ';'))->toBe(['Reference', 'Libelle', 'Quantite', 'Total', 'Conditionnement', 'Calcul', 'Dimensions', 'Description'])
        ->and(str_getcsv($lines[1], ';'))->toBe(['ROS-42', 'Commande 00042 - Rose rouge', '3', '7.50', '10*5*4', '200.00', '14.50 / 40-60 cm', 'Rose rouge à longue tige']);
});

it('keeps unknown variables visible in fixed custom rows', function (): void {
    $csv = (new OrderCsvService)->render([
        'delimiter' => ',',
        'scope' => 'document',
        'columns' => [['id' => 'value', 'name' => 'Valeur']],
        'rows' => [[
            'id' => 'fixed-row',
            'cells' => ['value' => '%client.name% / %future.variable%'],
        ]],
    ], collect(), [
        'client' => ['name' => 'Client test'],
    ]);

    expect($csv)->toContain('Client test / %future.variable%');
});

it('formats date and decimal variables with whitelisted formats', function (): void {
    $csv = (new OrderCsvService)->render([
        'delimiter' => ';',
        'scope' => 'document',
        'columns' => [
            ['id' => 'date', 'name' => 'Date'],
            ['id' => 'total', 'name' => 'Total'],
        ],
        'rows' => [[
            'id' => 'formatted-row',
            'cells' => [
                'date' => '%order.date|date:dmy%',
                'total' => '%order.total|decimal:3%',
            ],
        ]],
    ], collect(), [
        'order' => ['date' => '2026-08-23', 'total' => 12.5],
    ]);

    $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv);
    $lines = array_values(array_filter(explode("\n", trim((string) $csv))));

    expect(str_getcsv($lines[0], ';'))->toBe(['Date', 'Total'])
        ->and(str_getcsv($lines[1], ';'))->toBe(['23/08/2026', '12.500']);
});

it('renders ordered header item and footer blocks', function (): void {
    $product = new Product([
        'ref' => 'ROS-42',
        'name' => 'Rose rouge',
    ]);

    $csv = (new OrderCsvService)->render([
        'delimiter' => ';',
        'blocks' => [
            [
                'id' => 'header',
                'name' => 'Entete',
                'type' => 'header',
                'enabled' => true,
                'show_headers' => false,
                'columns' => [
                    ['id' => 'label', 'name' => 'Champ'],
                    ['id' => 'value', 'name' => 'Valeur'],
                ],
                'rows' => [[
                    'id' => 'order',
                    'cells' => ['label' => 'Commande', 'value' => '%order.number%'],
                ]],
            ],
            [
                'id' => 'disabled',
                'name' => 'Masque',
                'type' => 'header',
                'enabled' => false,
                'show_headers' => false,
                'columns' => [
                    ['id' => 'label', 'name' => 'Champ'],
                    ['id' => 'value', 'name' => 'Valeur'],
                ],
                'rows' => [[
                    'id' => 'hidden',
                    'cells' => ['label' => 'INVISIBLE', 'value' => 'INVISIBLE'],
                ]],
            ],
            [
                'id' => 'items',
                'name' => 'Produits',
                'type' => 'items',
                'enabled' => true,
                'show_headers' => true,
                'columns' => [
                    ['id' => 'label', 'name' => 'Reference'],
                    ['id' => 'value', 'name' => 'Total ligne'],
                    ['id' => 'product', 'name' => 'Produit'],
                ],
                'rows' => [[
                    'id' => 'item',
                    'cells' => [
                        'label' => '%product.reference%',
                        'value' => '%line_total%',
                        'product' => '%product.name%',
                    ],
                ]],
            ],
            [
                'id' => 'footer',
                'name' => 'Total',
                'type' => 'footer',
                'enabled' => true,
                'show_headers' => false,
                'columns' => [
                    ['id' => 'label', 'name' => 'Champ'],
                    ['id' => 'value', 'name' => 'Valeur'],
                ],
                'rows' => [[
                    'id' => 'total',
                    'cells' => ['label' => 'Total', 'value' => '%order.total%'],
                ]],
            ],
        ],
    ], collect([[
        'product' => $product,
        'quantity' => 3,
        'unit_price' => 2.5,
        'line_total' => 7.5,
    ]]), [
        'order' => ['number' => '00042', 'total' => '7.50'],
    ]);

    $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv);
    $lines = array_values(array_filter(explode("\n", trim((string) $csv))));

    expect(str_getcsv($lines[0], ';'))->toBe(['Commande', '00042', ''])
        ->and(str_getcsv($lines[1], ';'))->toBe(['Reference', 'Total ligne', 'Produit'])
        ->and(str_getcsv($lines[2], ';'))->toBe(['ROS-42', '7.50', 'Rose rouge'])
        ->and(str_getcsv($lines[3], ';'))->toBe(['Total', '7.50', ''])
        ->and($csv)->not->toContain('INVISIBLE');
});
