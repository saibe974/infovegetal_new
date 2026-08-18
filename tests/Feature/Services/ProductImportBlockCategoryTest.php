<?php

use App\Models\CategoryProducts;
use App\Models\DbProducts;
use App\Models\Product;
use App\Services\ProductImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

test('a block category remains active across import chunks', function () {
    Storage::fake('local');

    $category = CategoryProducts::create(['name' => 'Plantes fleuries']);
    $database = DbProducts::create([
        'name' => 'Block category test',
        'champs' => [
            'sku' => 'sku',
            'name' => 'name',
            'ean13' => 'ean13',
        ],
        'categories' => ['plantes-fleuries' => (string) $category->id],
        'traitement' => 'peplant',
        'category_mode' => 'block',
        'category_block_prefix' => "Famille d'articles:",
    ]);

    $id = 'block-category-import';
    Storage::makeDirectory("imports/tmp/$id");
    Storage::put(
        "imports/tmp/$id/data_0.csv",
        "sku;name;ean13;family\n;;;Famille d'articles: Plantes fleuries\nP-1;Produit 1;8717929879601;\n",
    );
    Storage::put(
        "imports/tmp/$id/data_1.csv",
        "sku;name;ean13;family\nP-2;Produit 2;8717929877102;\n",
    );
    Cache::put("import:$id", [
        'db_products_id' => $database->id,
        'processed' => 0,
        'errors' => 0,
        'total' => 3,
        'chunks_count' => 2,
    ]);

    $service = app(ProductImportService::class);
    $service->runChunk($id, 'imports/source.csv', 0);

    expect(Cache::get("import:$id:block_category"))->toBe('plantes-fleuries');

    $service->runChunk($id, 'imports/source.csv', 1);

    expect(Product::query()->orderBy('sku')->pluck('category_products_id')->all())
        ->toBe([$category->id, $category->id])
        ->and(Cache::has("import:$id:block_category"))->toBeFalse();
});
