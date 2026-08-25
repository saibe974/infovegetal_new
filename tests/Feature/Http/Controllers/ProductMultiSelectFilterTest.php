<?php

declare(strict_types=1);

use App\Http\Controllers\ProductController;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

function createMultiFilterDatabase(string $country): int
{
    return DB::table('db_products')->insertGetId([
        'name' => "multi-filter-{$country}",
        'description' => null,
        'champs' => null,
        'categories' => null,
        'country' => $country,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

function createMultiFilterProduct(string $suffix, int $dbProductId, string $pot, string $height): Product
{
    return Product::create([
        'sku' => "multi-filter-{$suffix}",
        'name' => "Multi filter {$suffix}",
        'price' => 10,
        'active' => true,
        'db_products_id' => $dbProductId,
        'ref' => "multi-filter-{$suffix}",
        'ean13' => '3' . str_pad((string) crc32($suffix), 12, '0', STR_PAD_LEFT),
        'pot' => $pot,
        'height' => $height,
    ]);
}

it('filters products with multiple countries, pot diameters and heights', function (): void {
    $frDatabase = createMultiFilterDatabase('FR');
    $nlDatabase = createMultiFilterDatabase('NL');
    $deDatabase = createMultiFilterDatabase('DE');

    createMultiFilterProduct('fr-match', $frDatabase, '12', '40');
    createMultiFilterProduct('nl-match', $nlDatabase, '14', '60');
    createMultiFilterProduct('country-miss', $deDatabase, '12', '40');
    createMultiFilterProduct('pot-miss', $frDatabase, '18', '40');
    createMultiFilterProduct('height-miss', $nlDatabase, '14', '80');

    $request = Request::create(route('products.index'), 'GET', [
        'country' => ['FR', 'NL'],
        'pot' => ['12', '14'],
        'height' => ['40', '60'],
        'sort' => 'name',
        'dir' => 'asc',
    ], [], [], [
        'HTTP_X_INERTIA' => 'true',
        'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
    ]);

    $response = app(ProductController::class)->index($request);
    $content = $response->toResponse($request)->getContent();
    $payload = is_string($content) ? json_decode($content, true) : [];

    expect(collect($payload['props']['collection']['data'] ?? [])->pluck('name')->all())
        ->toBe(['Multi filter fr-match', 'Multi filter nl-match'])
        ->and($payload['props']['filters']['country'] ?? null)->toBe(['FR', 'NL'])
        ->and($payload['props']['filters']['pot'] ?? null)->toBe(['12', '14'])
        ->and($payload['props']['filters']['height'] ?? null)->toBe(['40', '60']);
});
