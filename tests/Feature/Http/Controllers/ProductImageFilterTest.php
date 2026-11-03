<?php

declare(strict_types=1);

use App\Http\Controllers\ProductController;
use App\Models\Product;
use App\Services\ProductCatalogQuery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

function createImageFilterProduct(string $suffix, int $dbProductId, ?string $imageLink = null): Product
{
    return Product::create([
        'sku' => "image-filter-{$suffix}",
        'name' => "Image filter {$suffix}",
        'description' => null,
        'img_link' => $imageLink,
        'price' => 10,
        'active' => true,
        'attributes' => [],
        'category_products_id' => null,
        'db_products_id' => $dbProductId,
        'ref' => "image-filter-{$suffix}",
        'ean13' => str_pad((string) (1000000000000 + $dbProductId + strlen($suffix)), 13, '0', STR_PAD_LEFT),
        'pot' => null,
        'height' => null,
        'price_floor' => 9,
        'price_roll' => 8,
        'price_promo' => 0,
        'producer_id' => null,
        'tva_id' => null,
        'cond' => null,
        'floor' => null,
        'roll' => null,
        'unite' => null,
    ]);
}

function imageFilterPayload(string $image): array
{
    $request = Request::create(route('products.index'), 'GET', [
        'image' => $image,
        'sort' => 'name',
        'dir' => 'asc',
    ], [], [], [
        'HTTP_X_INERTIA' => 'true',
        'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
    ]);

    $response = app(ProductController::class)->index($request);
    $content = $response->toResponse($request)->getContent();

    return is_string($content) ? json_decode($content, true) : [];
}

it('offers image and promo states only when available under the other filters', function (): void {
    $ids = [];
    foreach (['FR', 'NL'] as $country) {
        $ids[$country] = DB::table('db_products')->insertGetId([
            'name' => "facet-{$country}",
            'country' => $country,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    $with = createImageFilterProduct('facet-with', $ids['FR'], 'https://example.test/image.jpg');
    $with->update(['price_promo' => 5]);
    $without = createImageFilterProduct('facet-without', $ids['FR']);
    $dutch = createImageFilterProduct('facet-dutch', $ids['NL'], 'https://example.test/image.jpg');
    $dutch->update(['price_promo' => 5]);

    foreach ([
        [['country' => ['FR']], ['image' => ['with', 'without'], 'promo' => [true, false]]],
        [['country' => ['NL']], ['image' => ['with'], 'promo' => [true]]],
        [['country' => ['FR'], 'image' => 'with'], ['image' => ['with', 'without'], 'promo' => [true]]],
        [['country' => ['FR'], 'promo' => '1'], ['image' => ['with'], 'promo' => [true, false]]],
        [['country' => ['DE']], ['image' => [], 'promo' => []]],
    ] as [$params, $expected]) {
        $catalog = new ProductCatalogQuery(Request::create('/products', 'GET', $params));
        $base = Product::query()->whereIn('id', [$with->id, $without->id, $dutch->id]);

        expect(ProductCatalogQuery::binaryFilterOptions($base, $catalog->filters, $catalog->applyFilters(...)))
            ->toBe($expected);
    }
});

it('filters products with a local media image or an external image link', function (): void {
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'image-filter-db',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $withoutImage = createImageFilterProduct('without', $dbProductId);
    createImageFilterProduct('link', $dbProductId, 'https://example.test/product.jpg');
    $withMedia = createImageFilterProduct('media', $dbProductId);

    $withMedia->media()->create([
        'collection_name' => 'images',
        'name' => 'product',
        'file_name' => 'product.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);

    $withPayload = imageFilterPayload('with');
    $withNames = collect($withPayload['props']['collection']['data'] ?? [])->pluck('name')->all();

    expect($withNames)->toBe(['Image filter link', 'Image filter media'])
        ->and($withPayload['props']['filters']['image'] ?? null)->toBe('with');

    $withoutPayload = imageFilterPayload('without');
    $withoutNames = collect($withoutPayload['props']['collection']['data'] ?? [])->pluck('name')->all();

    expect($withoutNames)->toBe([$withoutImage->name])
        ->and($withoutPayload['props']['filters']['image'] ?? null)->toBe('without');
});
