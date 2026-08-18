<?php

use App\Services\ProductImportService;

function invokeProductImportBlockMethod(string $method, mixed ...$arguments): mixed
{
    $service = app(ProductImportService::class);

    return (new ReflectionMethod($service, $method))->invoke($service, ...$arguments);
}

test('a valid ean13 is distinguished from a category block row', function () {
    expect(invokeProductImportBlockMethod('isValidEan13', '8717929879601'))->toBeTrue()
        ->and(invokeProductImportBlockMethod('isValidEan13', ''))->toBeFalse()
        ->and(invokeProductImportBlockMethod('isValidEan13', 'Famille d’articles'))->toBeFalse()
        ->and(invokeProductImportBlockMethod('isValidEan13', '8717929879602'))->toBeFalse();
});

test('a category label can be extracted with a prefix from any csv cell', function () {
    $label = invokeProductImportBlockMethod(
        'extractCategoryBlockLabel',
        ['Code' => '', 'Diamètre de pot' => "Famille d'articles: Plantes fleuries", 'EAN' => ''],
        "Famille d'articles:",
        null,
    );

    expect($label)->toBe('plantes-fleuries');
});

test('a category label can instead be extracted from a one based column number', function () {
    $label = invokeProductImportBlockMethod(
        'extractCategoryBlockLabel',
        ['Code' => '', 'Famille' => 'Plantes vertes', 'EAN' => ''],
        null,
        2,
    );

    expect($label)->toBe('Plantes vertes');
});

test('a block category uses the configured category mapping', function () {
    $categoryId = invokeProductImportBlockMethod(
        'resolveMappedCategoryId',
        'Plantes fleuries',
        ['plantes-fleuries' => '10'],
        [10, 51],
    );

    expect($categoryId)->toBe(10);
});
