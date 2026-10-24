<?php

use App\Models\CategoryProducts;
use App\Models\DbProducts;
use App\Models\Product;
use App\Services\ProductImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

test('peplant legacy minimum mapping imports carton minimums from the supplier file', function () {
    Storage::fake('local');
    CategoryProducts::unguarded(fn () => CategoryProducts::firstOrCreate(['id' => 51], ['name' => 'Default']));
    $database = DbProducts::create([
        'name' => 'Peplant minimum test',
        'traitement' => 'peplant',
        'champs' => [
            'ref' => 'sku', 'barcode' => 'ean13', 'omschrijving-foto' => 'name',
            'emballage' => 'cond', 'unite-carton' => 'minimum', 'prix' => 'price',
        ],
        'update_fields' => ['minimum'],
    ]);
    Product::create([
        'sku' => '5404008223952_77802', 'ref' => '77802', 'ean13' => '5404008223952',
        'name' => 'Existing', 'price' => 1, 'category_products_id' => 51, 'unite' => 1,
    ]);
    $id = 'peplant-minimum';
    Storage::put("imports/tmp/$id/data_0.csv", file_get_contents(__DIR__.'/../../Fixtures/peplant_minimum.csv'));
    Cache::put("import:$id", [
        'db_products_id' => $database->id, 'processed' => 0, 'errors' => 0, 'total' => 4, 'chunks_count' => 1,
    ]);

    app(ProductImportService::class)->runChunk($id, 'imports/source.csv', 0);

    foreach (['77802' => 2, '48245' => 5, '9317' => 7, '32962' => 5] as $ref => $minimum) {
        expect(Product::where('ref', $ref)->firstOrFail()->unite)->toBe($minimum);
    }
    $analysis = app(\App\Services\ProductImportPreAnalyzer::class)->analyze(__DIR__.'/../../Fixtures/peplant_minimum.csv');
    expect(collect($analysis['columns'])->firstWhere('normalized_key', 'unite-carton')['suggested_target'])->toBe('unite');
});

test('product imports persist mapped minimums and fall back to packaging', function () {
    Storage::fake('local');
    CategoryProducts::unguarded(fn () => CategoryProducts::firstOrCreate(['id' => 51], ['name' => 'Default']));
    $database = DbProducts::create([
        'name' => 'Minimum import test',
        'champs' => ['sku' => 'sku', 'name' => 'name', 'pack' => 'cond', 'minimum' => 'unite'],
        'traitement' => 'eurofleurs',
        'update_fields' => ['unite', 'cond'],
    ]);
    Product::create(['sku' => '4000627096451_9645', 'ref' => '9645', 'ean13' => '4000627096451', 'name' => 'Existing', 'price' => 1, 'category_products_id' => 51, 'unite' => 6]);

    $id = 'minimum-import';
    Storage::put("imports/tmp/$id/data_0.csv", "sku;name;pack;minimum\n9645;Updated;6;24\n9646;Fallback;6;\n9647;Invalid;8;0\n");
    Cache::put("import:$id", [
        'db_products_id' => $database->id,
        'processed' => 0,
        'errors' => 0,
        'total' => 3,
        'chunks_count' => 1,
    ]);

    app(ProductImportService::class)->runChunk($id, 'imports/source.csv', 0);

    expect(Product::orderBy('sku')->pluck('unite')->all())->toBe([24, 6, 8]);
});
