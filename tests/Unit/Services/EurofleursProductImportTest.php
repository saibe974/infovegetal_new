<?php

require_once __DIR__.'/../../../app/Services/ProductImportTraitement/eurofleurs.php';

test('it generates an ean13 from the eurofleurs id mapped as sku', function () {
    $mapped = [
        'id' => '9645',
        'ean' => '',
        'article' => 'Aeschynanthus japhrolepis',
    ];
    $mapping = [
        'id' => 'sku',
        'ean' => 'ean13',
        'article' => 'name',
    ];
    $resolve = static function (array $row, ?array $defaults, string $target): mixed {
        $source = array_search($target, $defaults ?? [], true);

        return $source !== false ? ($row[$source] ?? null) : ($row[$target] ?? null);
    };

    $product = importProducts_eurofleurs([
        'mapped' => $mapped,
        'defaultsMap' => $mapping,
        'validCategoryIds' => [51],
        'defaultsMapCategories' => [],
        'db_products_id' => 3,
    ], $resolve);

    expect($product)
        ->not->toHaveKey('error')
        ->and($product['ean13'])->toBe('4000627096451')
        ->and($product['sku'])->toBe('4000627096451_9645');
});
