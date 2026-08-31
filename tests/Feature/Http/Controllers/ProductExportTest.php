<?php

use App\Http\Resources\ProductResource;
use App\Models\CategoryProducts;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Spatie\MediaLibrary\Conversions\FileManipulator;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->admin = User::factory()->withoutTwoFactor()->create();
    $this->admin->assignRole(Role::findOrCreate('admin', 'web'));
    $this->actingAs($this->admin);
    $this->dbId = DB::table('db_products')->insertGetId([
        'name' => 'Catalogue test export',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
});

function exportProduct(int $database, string $suffix, array $attributes = []): Product
{
    return Product::create(array_merge([
        'sku' => '000'.$suffix,
        'ref' => 'ref-'.$suffix,
        'ean13' => '0012345678901',
        'name' => 'Plante '.$suffix,
        'price' => 12.5,
        'price_floor' => 11,
        'price_roll' => 10,
        'price_promo' => 8,
        'db_products_id' => $database,
        'active' => true,
        'pot' => 12,
        'height' => '40',
    ], $attributes));
}

function productExportUrl(array $parameters = []): string
{
    return route('products.admin.export').'?'.http_build_query(array_merge([
        'format' => 'csv',
        'columns' => ['id', 'sku', 'name'],
    ], $parameters));
}

function readProductExportCsv(string $content): array
{
    $handle = fopen('php://temp', 'w+');
    fwrite($handle, str_starts_with($content, "\xEF\xBB\xBF") ? substr($content, 3) : $content);
    rewind($handle);
    $rows = [];
    while (($row = fgetcsv($handle, null, ';', '"', '')) !== false) {
        $rows[] = $row;
    }
    fclose($handle);

    return $rows;
}

it('exports every matching page with the same category, multi filters, promotion and sort as the catalogue', function () {
    config(['product-export.chunk_size' => 10]);
    $parent = CategoryProducts::create(['name' => 'Parent']);
    $child = CategoryProducts::create(['name' => 'Enfant']);
    $child->appendToNode($parent)->save();
    $matches = collect(range(1, 27))->map(fn ($index) => exportProduct($this->dbId, sprintf('%02d', $index), [
        'category_products_id' => $child->id,
        'img_link' => 'https://example.test/plant.jpg',
    ]));
    exportProduct($this->dbId, 'wrong-pot', ['pot' => 18, 'category_products_id' => $child->id]);
    exportProduct($this->dbId, 'wrong-height', ['height' => '80', 'category_products_id' => $child->id]);
    exportProduct($this->dbId, 'inactive', ['active' => false, 'category_products_id' => $child->id]);
    exportProduct($this->dbId, 'no-category');
    exportProduct($this->dbId, 'no-promo', ['price_promo' => 10, 'category_products_id' => $child->id]);

    $filters = [
        'q' => 'Plante', 'category' => $parent->id, 'country' => ['FR', 'NL'],
        'pot' => ['12', '14'], 'height' => ['40', '60'], 'image' => 'with', 'promo' => '1',
        'sort' => 'sku', 'dir' => 'desc',
    ];
    $expected = $matches->reverse()->pluck('id')->map(fn ($id) => (string) $id)->values()->all();
    $response = $this->get(productExportUrl($filters + ['page' => 2]));
    $response->assertOk()->assertDownload();
    $rows = readProductExportCsv($response->streamedContent());
    expect($rows[0])->toBe(['ID', 'SKU', 'Nom'])
        ->and(array_column(array_slice($rows, 1), 0))->toBe($expected);

    $page = $this->get(route('products.index').'?'.http_build_query($filters));
    $page->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('collection.meta.total', 27)
        ->where('collection.data', fn ($rows) => collect($rows)->pluck('id')->map('strval')->all() === array_slice($expected, 0, 24)));
});

it('keeps cart and inactive filters and rejects an empty cart', function () {
    $inactive = exportProduct($this->dbId, 'inactive', ['active' => false]);
    exportProduct($this->dbId, 'other');
    $this->withSession(['cart_filter_ids' => [$inactive->id]]);
    $response = $this->get(productExportUrl(['cart' => '1', 'active' => '0', 'columns' => ['id', 'active']]));
    $response->assertOk();
    expect(readProductExportCsv($response->streamedContent()))->toBe([
        ['ID', 'Actif'], [(string) $inactive->id, '0'],
    ]);
    $this->withSession(['cart_filter_ids' => []])
        ->getJson(productExportUrl(['cart' => '1']))->assertUnprocessable()->assertJsonValidationErrors('export');
});

it('checks permissions and exports only accessible, orderable products at the displayed prices', function () {
    $client = User::factory()->withoutTwoFactor()->create();
    $this->actingAs($client)->getJson(productExportUrl())->assertForbidden();
    $client->givePermissionTo(Permission::findOrCreate('export products', 'web'));
    $client->dbProducts()->attach($this->dbId, ['attributes' => json_encode(['m' => 25, 'p' => -1])]);
    $product = exportProduct($this->dbId, 'visible');
    exportProduct($this->dbId, 'future', ['available_from' => now()->addDay()]);
    exportProduct($this->dbId, 'expired', ['available_until' => now()->subDay()]);
    exportProduct($this->dbId, 'inactive', ['active' => false]);
    $otherDb = DB::table('db_products')->insertGetId(['name' => 'Private', 'country' => 'FR']);
    exportProduct($otherDb, 'private');

    $request = Request::create('/products');
    $request->setUserResolver(fn () => $client);
    $displayed = (new ProductResource($product))->toArray($request);
    $response = $this->get(productExportUrl(['columns' => ['id', 'price', 'price_roll', 'price_promo']]));
    $response->assertOk();
    $rows = readProductExportCsv($response->streamedContent());
    expect($rows)->toHaveCount(2)
        ->and($rows[1][0])->toBe((string) $product->id)
        ->and((float) $rows[1][1])->toBe((float) $displayed['price'])
        ->and((float) $rows[1][2])->toBe((float) $displayed['price_roll'])
        ->and((float) $rows[1][3])->toBe((float) $displayed['price_promo']);
});

it('enforces format, columns and synchronous limits on checks and actual downloads', function () {
    exportProduct($this->dbId, 'one');
    exportProduct($this->dbId, 'two');
    config(['product-export.xlsx_max_rows' => 2, 'product-export.xlsx_image_max_rows' => 1, 'product-export.csv_max_rows' => 2]);
    $this->getJson(productExportUrl(['format' => 'pdf']))->assertUnprocessable()->assertJsonValidationErrors('format');
    $this->getJson(productExportUrl(['columns' => []]))->assertUnprocessable()->assertJsonValidationErrors('columns');
    $this->getJson(productExportUrl(['columns' => ['password']]))->assertUnprocessable()->assertJsonValidationErrors('columns.0');
    $this->getJson(productExportUrl(['columns' => ['id', 'id']]))->assertUnprocessable();
    foreach ([false, true] as $check) {
        $this->getJson(productExportUrl(['format' => 'xlsx', 'columns' => ['image'], 'check' => (int) $check]))
            ->assertUnprocessable()->assertJsonValidationErrors('export');
    }
    $this->getJson(productExportUrl(['format' => 'xlsx', 'check' => 1]))->assertOk()->assertJsonPath('total', 2);
    exportProduct($this->dbId, 'three');
    $this->getJson(productExportUrl())->assertUnprocessable()->assertJsonValidationErrors('export');
    $this->getJson(productExportUrl(['format' => 'xlsx']))->assertUnprocessable()->assertJsonValidationErrors('export');
});

it('writes safe UTF-8 CSV text with delimiters, newlines and image URLs', function () {
    exportProduct($this->dbId, 'text', [
        'name' => '=1+1',
        'description' => "Érable; \"rouge\"\nDeuxième ligne",
        'img_link' => 'https://example.test/plant.jpg',
    ]);
    $response = $this->get(productExportUrl(['columns' => ['description', 'name', 'image']]));
    $response->assertOk();
    $content = $response->streamedContent();
    expect(str_starts_with($content, "\xEF\xBB\xBF"))->toBeTrue()
        ->and(readProductExportCsv($content)[1])->toBe([
            "Érable; \"rouge\"\nDeuxième ligne", "'=1+1", 'https://example.test/plant.jpg',
        ]);
});

it('embeds only existing thumbnails in a real Excel file without generating or fetching original images', function () {
    Storage::fake('public');
    Http::preventStrayRequests();
    Bus::fake();
    $this->mock(FileManipulator::class)->shouldNotReceive('createDerivedFiles');
    $products = collect(['ready', 'uncreated', 'missing', 'original-only', 'corrupt', 'external'])
        ->map(fn ($name) => exportProduct($this->dbId, $name, ['name' => '=1+1', 'img_link' => 'https://example.test/original.jpg']));

    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9X8AAAAASUVORK5CYII=');
    foreach ($products->take(5) as $index => $product) {
        $media = $product->media()->create([
            'collection_name' => 'images', 'name' => 'plant-'.$index, 'file_name' => 'plant-'.$index.'.png',
            'mime_type' => 'image/png', 'disk' => 'public', 'conversions_disk' => 'public', 'size' => strlen($png),
            'manipulations' => [], 'custom_properties' => [], 'responsive_images' => [],
            'generated_conversions' => in_array($index, [0, 2, 4], true) ? ['thumb' => true] : [],
        ]);
        $media->setRelation('model', $product);
        Storage::disk('public')->put($media->getPathRelativeToRoot(), $png);
        if (in_array($index, [0, 1, 4], true)) {
            Storage::disk('public')->put($media->getPathRelativeToRoot('thumb'), $index === 4 ? 'broken' : $png);
        }
    }
    $before = Storage::disk('public')->allFiles();
    $response = $this->get(productExportUrl([
        'format' => 'xlsx', 'columns' => ['sku', 'ean13', 'name', 'price', 'image'], 'sort' => 'id', 'dir' => 'asc',
    ]));
    $response->assertOk()->assertDownload();
    $path = $response->baseResponse->getFile()->getPathname();
    $book = IOFactory::load($path);
    try {
        $sheet = $book->getActiveSheet();
        expect($sheet->getHighestRow())->toBe(7)
            ->and($sheet->getCell('A2')->getValue())->toBe('000ready')
            ->and($sheet->getCell('B2')->getValue())->toBe('0012345678901')
            ->and($sheet->getCell('C2')->getValue())->toBe('=1+1')
            ->and($sheet->getCell('C2')->getDataType())->toBe(DataType::TYPE_STRING)
            ->and($sheet->getCell('D2')->getValue())->toEqual(12.5)
            ->and($sheet->getDrawingCollection())->toHaveCount(1)
            ->and($sheet->getDrawingCollection()[0]->getCoordinates())->toBe('E2')
            ->and(Storage::disk('public')->allFiles())->toBe($before);
        Bus::assertNothingDispatched();
        Http::assertNothingSent();
    } finally {
        $book->disconnectWorksheets();
        unlink($path);
    }
});
