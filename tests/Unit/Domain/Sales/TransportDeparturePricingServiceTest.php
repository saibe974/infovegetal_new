<?php

declare(strict_types=1);

use App\Domain\Sales\Services\TransportDeparturePricingService;
use App\Models\Carrier;
use App\Models\CarrierZone;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(Tests\TestCase::class, RefreshDatabase::class);

/**
 * Business Rules:
 * BR-029
 * BR-035
 */
it('calculates the shipping total from zone tariffs and carrier tax', function (): void {
    $carrier = Carrier::create([
        'name' => 'Carrier vat',
        'country' => 'FR',
        'days' => 2,
        'minimum' => 0,
        'taxgo' => 20,
    ]);

    $zone = CarrierZone::create([
        'carrier_id' => $carrier->id,
        'name' => 'Zone VAT',
        'tariffs' => [
            'mini' => 0,
            'roll:1-3' => 150,
        ],
    ]);

    $service = new TransportDeparturePricingService();
    $shipping = $service->calculate([
        'suppliers' => [
            [
                'supplier_id' => 1,
                'mod_liv' => 'roll',
                'rolls' => [
                    ['coef' => 1.0],
                    ['coef' => 1.0],
                ],
            ],
        ],
    ], [
        1 => [
            't' => $carrier->id,
            'z' => $zone->id,
            'p' => 0,
            'l' => 20,
        ],
    ]);

    expect($shipping)->toBe(360.0);
});

/**
 * Business Rules:
 * BR-029
 * BR-035
 */
it('returns zero when the shipping inputs do not yield a valid tariff', function (): void {
    $service = new TransportDeparturePricingService();

    expect($service->calculate(['suppliers' => []], []))->toBe(0.0);
});