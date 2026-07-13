<?php

declare(strict_types=1);

use App\Http\Resources\ProductResource;
use App\Models\Carrier;
use App\Models\CarrierZone;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;

uses(Tests\TestCase::class, RefreshDatabase::class);

function productResourceResolveTransport(ProductResource $resource, Request $request, ?array $attrs = null): ?array
{
    $method = new ReflectionMethod($resource, 'resolveDbUserTransport');
    $method->setAccessible(true);

    return $method->invoke($resource, $request, $attrs);
}

/**
 * Business Rules:
 * BR-036
 */
it('resolves an applicable carrier and zone transport context', function (): void {
    $carrier = Carrier::create([
        'name' => 'Applicable carrier',
        'country' => 'FR',
        'days' => 2,
        'minimum' => 100,
        'taxgo' => 20,
    ]);

    $zone = CarrierZone::create([
        'carrier_id' => $carrier->id,
        'name' => 'Base X',
        'tariffs' => [
            'mini' => 120,
            'roll:1-3' => 150,
        ],
    ]);

    $resource = new ProductResource(new Product());
    $request = Request::create('/');

    $transport = productResourceResolveTransport($resource, $request, [
        't' => $carrier->id,
        'z' => $zone->id,
    ]);

    expect($transport)->toBe([
        'carrier_id' => $carrier->id,
        'zone_id' => $zone->id,
        'zone_name' => 'Base X',
        'taxgo' => 20.0,
        'tariffs' => [
            'mini' => 120,
            'roll:1-3' => 150,
        ],
    ]);
});

/**
 * Business Rules:
 * BR-036
 */
it('returns null when the carrier or zone is not eligible', function (): void {
    $carrier = Carrier::create([
        'name' => 'Carrier without matching zone',
        'country' => 'FR',
        'days' => 3,
        'minimum' => 0,
        'taxgo' => 0,
    ]);

    $resource = new ProductResource(new Product());
    $request = Request::create('/');

    expect(productResourceResolveTransport($resource, $request, [
        't' => $carrier->id,
        'z' => 999999,
    ]))->toBeNull()
        ->and(productResourceResolveTransport($resource, $request, [
            't' => 999999,
            'z' => $carrier->id,
        ]))->toBeNull();
});