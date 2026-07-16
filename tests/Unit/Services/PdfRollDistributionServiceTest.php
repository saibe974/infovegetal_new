<?php

declare(strict_types=1);

use App\Models\DbProducts;
use App\Models\Product;
use App\Services\PdfRollDistributionService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(Tests\TestCase::class, RefreshDatabase::class);

function makeRollProduct(int $dbProductId, int $cond, int $floor, int $roll, int $quantity): array
{
    $product = new Product();
    $product->id = $dbProductId;
    $product->db_products_id = $dbProductId;
    $product->name = 'Roll product ' . $dbProductId;
    $product->cond = $cond;
    $product->floor = $floor;
    $product->roll = $roll;

    $dbProduct = DbProducts::create([
        'name' => 'Db product ' . $dbProductId,
        'description' => null,
        'champs' => null,
        'categories' => null,
        'country' => 'FR',
        'mod_liv' => 'roll',
        'mini' => 0,
    ]);

    $product->setRelation('dbProduct', $dbProduct);

    return ['product' => $product, 'quantity' => $quantity];
}

function pdfRollDistributionFirstTri(PdfRollDistributionService $service, iterable $items): array
{
    $method = new ReflectionMethod($service, 'firstTri');
    $method->setAccessible(true);

    return $method->invoke($service, collect($items));
}

function pdfRollDistributionBinpack(PdfRollDistributionService $service, array $supplierTri): array
{
    $method = new ReflectionMethod($service, 'binpack');
    $method->setAccessible(true);

    return $method->invoke($service, $supplierTri);
}

/**
 * Business Rules:
 * BR-038
 */
it('converts product quantities into cartons deterministically', function (): void {
    $service = new PdfRollDistributionService();

    $items = collect([
        makeRollProduct(101, 6, 2, 3, 44),
    ]);

    $supplierTri = pdfRollDistributionFirstTri($service, $items)[101] ?? [];

    expect($supplierTri['cartons'] ?? [])
        ->toHaveCount(1)
        ->and($supplierTri['etagfull'] ?? [])
        ->toHaveCount(0)
        ->and($supplierTri['rollfull'] ?? [])
        ->toHaveCount(1)
        ->and($supplierTri['non_roll_items'] ?? [])
        ->toBe([]);
});

/**
 * Business Rules:
 * BR-038
 */
it('returns no cartons when the conditioning data is missing or invalid', function (): void {
    $service = new PdfRollDistributionService();

    $product = new Product();
    $product->id = 102;
    $product->db_products_id = 102;
    $product->name = 'Invalid roll product';
    $product->cond = 0;
    $product->floor = 2;
    $product->roll = 3;
    $product->setRelation('dbProduct', DbProducts::create([
        'name' => 'Db product 102',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'country' => 'FR',
        'mod_liv' => 'roll',
        'mini' => 0,
    ]));

    $supplierTri = pdfRollDistributionFirstTri($service, [
        ['product' => $product, 'quantity' => 42],
    ])[102] ?? [];

    expect($supplierTri['cartons'] ?? [])
        ->toHaveCount(0)
        ->and($supplierTri['etagfull'] ?? [])
        ->toHaveCount(0)
        ->and($supplierTri['rollfull'] ?? [])
        ->toHaveCount(0);
});

/**
 * Business Rules:
 * BR-039
 */
it('groups cartons into a full etage when the floor capacity is reached', function (): void {
    $service = new PdfRollDistributionService();

    $items = collect([
        makeRollProduct(201, 5, 2, 3, 10),
    ]);

    $supplierTri = pdfRollDistributionFirstTri($service, $items)[201] ?? [];

    expect($supplierTri['etagfull'] ?? [])
        ->toHaveCount(1)
        ->and($supplierTri['cartons'] ?? [])
        ->toHaveCount(0)
        ->and($supplierTri['rollfull'] ?? [])
        ->toHaveCount(0);
});

/**
 * Business Rules:
 * BR-039
 */
it('keeps a partial quantity as cartons until an etage can be formed', function (): void {
    $service = new PdfRollDistributionService();

    $items = collect([
        makeRollProduct(202, 5, 2, 3, 5),
    ]);

    $supplierTri = pdfRollDistributionFirstTri($service, $items)[202] ?? [];

    expect($supplierTri['cartons'] ?? [])
        ->toHaveCount(1)
        ->and($supplierTri['etagfull'] ?? [])
        ->toHaveCount(0)
        ->and($supplierTri['rollfull'] ?? [])
        ->toHaveCount(0);
});

/**
 * Business Rules:
 * BR-039
 */
it('returns no etages when the capacity is missing', function (): void {
    $service = new PdfRollDistributionService();

    $items = collect([
        makeRollProduct(203, 5, 0, 3, 10),
    ]);

    $supplierTri = pdfRollDistributionFirstTri($service, $items)[203] ?? [];

    expect($supplierTri['cartons'] ?? [])
        ->toHaveCount(0)
        ->and($supplierTri['etagfull'] ?? [])
        ->toHaveCount(0)
        ->and($supplierTri['rollfull'] ?? [])
        ->toHaveCount(0);
});

/**
 * Business Rules:
 * BR-041
 */
it('groups full etages into a single roll with coherent counters', function (): void {
    $service = new PdfRollDistributionService();

    $items = collect([
        makeRollProduct(301, 2, 2, 3, 12),
    ]);

    $distribution = $service->build($items);
    $supplier = $distribution['suppliers'][0] ?? [];

    expect($distribution['totals']['roll_count'] ?? null)->toBe(1)
        ->and($distribution['totals']['floor_count'] ?? null)->toBe(3)
        ->and($distribution['totals']['carton_count'] ?? null)->toBe(6)
        ->and($supplier['roll_count'] ?? null)->toBe(1)
        ->and($supplier['floor_count'] ?? null)->toBe(3)
        ->and($supplier['carton_count'] ?? null)->toBe(6)
        ->and($supplier['coef_avg'] ?? null)->toBe(100.0)
        ->and($supplier['loss_total'] ?? null)->toBe(0.0);
});

/**
 * Business Rules:
 * BR-043
 */
it('keeps different producer bases separated in the final roll distribution', function (): void {
    $service = new PdfRollDistributionService();

    $items = collect([
        makeRollProduct(401, 2, 2, 3, 12),
        makeRollProduct(402, 2, 2, 3, 12),
    ]);

    $distribution = $service->build($items);
    $supplierIds = array_map(fn (array $supplier) => $supplier['supplier_id'], $distribution['suppliers']);

    expect($distribution['suppliers'])->toHaveCount(2)
        ->and($supplierIds)->toBe([401, 402])
        ->and($distribution['suppliers'][0]['roll_count'] ?? null)->toBe(1)
        ->and($distribution['suppliers'][1]['roll_count'] ?? null)->toBe(1);
});

/**
 * Business Rules:
 * BR-040
 * BR-044
 */
it('regroups compatible cartons into optimized rolls', function (array $cartons, int $expectedRollCount, int $expectedEtageCount, float $expectedCoef, float $expectedLoss): void {
    $service = new PdfRollDistributionService();

    $rolls = pdfRollDistributionBinpack($service, [
        'name' => 'Supplier',
        'country' => 'FR',
        'mini' => 0,
        'mod_liv' => 'roll',
        'cartons' => $cartons,
        'rollfull' => [],
        'etagfull' => [],
        'non_roll_items' => [],
    ]);

    expect($rolls)->toHaveCount($expectedRollCount)
        ->and($rolls[0]['nbetages'] ?? null)->toBe($expectedEtageCount)
        ->and($rolls[0]['coef'] ?? null)->toBe($expectedCoef)
        ->and($rolls[0]['perte'] ?? null)->toBe($expectedLoss);
})->with([
    'non regroupable single carton' => [[['product_id' => 1, 'x' => 70.0, 'y' => 40.0]], 1, 1, 28.0, 72.0],
    'regroupable pair' => [[['product_id' => 1, 'x' => 50.0, 'y' => 40.0], ['product_id' => 2, 'x' => 50.0, 'y' => 40.0]], 1, 1, 40.0, 60.0],
    'mixed case' => [[['product_id' => 1, 'x' => 60.0, 'y' => 50.0], ['product_id' => 2, 'x' => 40.0, 'y' => 40.0], ['product_id' => 3, 'x' => 40.0, 'y' => 40.0]], 1, 2, 62.0, 38.0],
]);