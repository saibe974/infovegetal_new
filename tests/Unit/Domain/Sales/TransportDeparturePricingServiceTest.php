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

/**
 * Business Rules:
 * BR-029
 * BR-035
 */
it('supports multi-options transport stored as JSON in t', function (): void {
    $carrierA = Carrier::create([
        'name' => 'Carrier A',
        'country' => 'FR',
        'days' => 2,
        'minimum' => 0,
        'taxgo' => 0,
    ]);

    $zoneA = CarrierZone::create([
        'carrier_id' => $carrierA->id,
        'name' => 'Zone A',
        'tariffs' => [
            'mini' => 0,
            'roll:1-3' => 100,
        ],
    ]);

    $carrierB = Carrier::create([
        'name' => 'Carrier B',
        'country' => 'FR',
        'days' => 2,
        'minimum' => 0,
        'taxgo' => 0,
    ]);

    $zoneB = CarrierZone::create([
        'carrier_id' => $carrierB->id,
        'name' => 'Zone B',
        'tariffs' => [
            'mini' => 0,
            'roll:1-3' => 200,
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
            't' => json_encode([
                ['carrier_id' => $carrierA->id, 'zone_id' => $zoneA->id],
                ['carrier_id' => $carrierB->id, 'zone_id' => $zoneB->id],
            ]),
            'z' => $zoneB->id,
            'p' => 0,
            'l' => 20,
        ],
    ]);

    expect($shipping)->toBe(400.0);
});

/**
 * Business Rules:
 * BR-028
 * BR-035
 */
it('uses carrier taxgo instead of tva from transport option json', function (): void {
    $carrier = Carrier::create([
        'name' => 'Carrier taxgo priority',
        'country' => 'FR',
        'days' => 2,
        'minimum' => 0,
        'taxgo' => 20,
    ]);

    $zone = CarrierZone::create([
        'carrier_id' => $carrier->id,
        'name' => 'Zone taxgo priority',
        'tariffs' => [
            'mini' => 0,
            'roll:1-3' => 100,
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
            't' => json_encode([
                ['carrier_id' => $carrier->id, 'zone_id' => $zone->id, 'tva' => 49],
            ]),
            'z' => $zone->id,
            'p' => 0,
            'l' => 20,
        ],
    ]);

    expect($shipping)->toBe(240.0);
});

/**
 * Business Rules:
 * BR-029
 */
it('applies custom minimum lm and custom vat tvat in departure mode', function (): void {
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
            'p' => 0,
            'l' => 100,
            'lm' => 300,
            'tvat' => 10,
        ],
    ]);

    expect($shipping)->toBe(330.0);
});

/**
 * Business Rules:
 * BR-030
 */
it('applies custom minimum lm and custom vat tvat in rendered mode', function (): void {
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
            'p' => 1,
            'l' => 100,
            'lm' => 300,
            'tvat' => 10,
        ],
    ]);

    expect($shipping)->toBe(110.0);
});