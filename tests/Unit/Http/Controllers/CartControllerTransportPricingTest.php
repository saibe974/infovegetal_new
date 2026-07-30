<?php

declare(strict_types=1);

use App\Http\Controllers\CartController;
use App\Models\Carrier;
use App\Models\CarrierZone;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(Tests\TestCase::class, RefreshDatabase::class);

function cartControllerPickZoneTariff(int $rollCount, array $tariffs): float
{
    $controller = new CartController();
    $method = new ReflectionMethod($controller, 'pickZoneTariff');
    $method->setAccessible(true);

    return (float) $method->invoke($controller, $rollCount, $tariffs);
}

function cartControllerTariffToFillRatio(float $coef): float
{
    $controller = new CartController();
    $method = new ReflectionMethod($controller, 'tariffToFillRatio');
    $method->setAccessible(true);

    return (float) $method->invoke($controller, $coef);
}

function cartControllerBuildPdfPayload(array $itemsInput, User $user, float $shippingTotal, array $transportSelection = []): array
{
    $controller = new CartController();
    $method = new ReflectionMethod($controller, 'buildPdfPayload');
    $method->setAccessible(true);

    return $method->invoke($controller, $itemsInput, $user, $shippingTotal, false, $transportSelection);
}

/**
 * Business Rules:
 * BR-029
 */
it('selects the matching zone tariff for the given roll count', function (): void {
    $tariffs = [
        'mini' => 120,
        'roll:1-3' => 150,
        'roll:4-6' => 110,
    ];

    expect(cartControllerPickZoneTariff(2, $tariffs))->toBe(150.0)
        ->and(cartControllerPickZoneTariff(5, $tariffs))->toBe(110.0);
});

/**
 * Business Rules:
 * BR-029
 */
it('falls back to the closest upper tier when no lower tier matches the roll count', function (): void {
    $tariffs = [
        'mini' => 120,
        'roll:4-6' => 110,
    ];

    expect(cartControllerPickZoneTariff(1, $tariffs))->toBe(110.0)
        ->and(cartControllerPickZoneTariff(0, $tariffs))->toBe(0.0);
});

/**
 * Business Rules:
 * BR-034
 */
it('applies the carrier monetary minimum when the tiered total is below the floor', function (): void {
    $carrier = Carrier::create([
        'name' => 'Carrier minimum',
        'country' => 'FR',
        'days' => 2,
        'minimum' => 999,
        'taxgo' => 0,
    ]);

    $zone = CarrierZone::create([
        'carrier_id' => $carrier->id,
        'name' => 'Zone A',
        'tariffs' => [
            'mini' => 350,
            'roll:1-3' => 20,
        ],
    ]);

    $controller = new CartController();
    $method = new ReflectionMethod($controller, 'computeShippingFromRollDistribution');
    $method->setAccessible(true);

    $rollDistribution = [
        'suppliers' => [
            [
                'supplier_id' => 1,
                'mod_liv' => 'roll',
                'rolls' => [
                    ['coef' => 1.0],
                ],
            ],
        ],
    ];

    $pivotsByDbProductId = [
        1 => [
            't' => $carrier->id,
            'z' => $zone->id,
            'p' => 0,
            'l' => 20,
        ],
    ];

    $shipping = $method->invoke($controller, $rollDistribution, $pivotsByDbProductId);

    expect($shipping)->toBe(350.0);
});

/**
 * Business Rules:
 * BR-028
 */
it('applies transport vat on the computed shipping total', function (): void {
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

    $controller = new CartController();
    $method = new ReflectionMethod($controller, 'computeShippingFromRollDistribution');
    $method->setAccessible(true);

    $rollDistribution = [
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
    ];

    $pivotsByDbProductId = [
        1 => [
            't' => $carrier->id,
            'z' => $zone->id,
            'p' => 0,
            'l' => 20,
        ],
    ];

    $shipping = $method->invoke($controller, $rollDistribution, $pivotsByDbProductId);

    expect($shipping)->toBe(360.0);
});

/**
 * Business Rules:
 * BR-035
 */
it('uses the zone-specific tariff when the delivery zone changes', function (): void {
    $carrier = Carrier::create([
        'name' => 'Carrier zones',
        'country' => 'FR',
        'days' => 3,
        'minimum' => 0,
        'taxgo' => 0,
    ]);

    $zoneA = CarrierZone::create([
        'carrier_id' => $carrier->id,
        'name' => 'Zone A',
        'tariffs' => [
            'mini' => 0,
            'roll:1-3' => 150,
        ],
    ]);

    $zoneB = CarrierZone::create([
        'carrier_id' => $carrier->id,
        'name' => 'Zone B',
        'tariffs' => [
            'mini' => 0,
            'roll:1-3' => 90,
        ],
    ]);

    $controller = new CartController();
    $method = new ReflectionMethod($controller, 'computeShippingFromRollDistribution');
    $method->setAccessible(true);

    $rollDistribution = [
        'suppliers' => [
            [
                'supplier_id' => 10,
                'mod_liv' => 'roll',
                'rolls' => [
                    ['coef' => 1.0],
                    ['coef' => 1.0],
                ],
            ],
            [
                'supplier_id' => 11,
                'mod_liv' => 'roll',
                'rolls' => [
                    ['coef' => 1.0],
                    ['coef' => 1.0],
                ],
            ],
        ],
    ];

    $pivotsByDbProductId = [
        10 => [
            't' => $carrier->id,
            'z' => $zoneA->id,
            'p' => 0,
            'l' => 20,
        ],
        11 => [
            't' => $carrier->id,
            'z' => $zoneB->id,
            'p' => 0,
            'l' => 20,
        ],
    ];

    $shipping = $method->invoke($controller, $rollDistribution, $pivotsByDbProductId);

    expect($shipping)->toBe(480.0);
});

/**
 * Business Rules:
 * BR-042
 */
it('normalizes roll fill ratios within the zero to one range', function (): void {
    expect(cartControllerTariffToFillRatio(0.8))->toBe(0.8)
        ->and(cartControllerTariffToFillRatio(150.0))->toBe(1.0)
        ->and(cartControllerTariffToFillRatio(-0.2))->toBe(0.0);
});

/**
 * Business Rules:
 * BR-045
 */
it('adds transport to the product total in the cart payload', function (): void {
    $user = User::factory()->create();

    $carrier = Carrier::create([
        'name' => 'Carrier total',
        'country' => 'FR',
        'days' => 2,
        'minimum' => 0,
        'taxgo' => 0,
    ]);

    $zone = CarrierZone::create([
        'carrier_id' => $carrier->id,
        'name' => 'Zone total',
        'tariffs' => [
            'mini' => 0,
            'roll:1-3' => 150,
        ],
    ]);

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-total',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'country' => 'FR',
        'mod_liv' => 'roll',
        'mini' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_user')->insert([
        'db_product_id' => $dbProductId,
        'user_id' => $user->id,
        'attributes' => json_encode(['t' => $carrier->id, 'z' => $zone->id, 'p' => 0]),
    ]);

    $product = Product::create([
        'sku' => 'total-product',
        'name' => 'Total product',
        'description' => null,
        'img_link' => null,
        'price' => 10,
        'active' => true,
        'attributes' => [],
        'category_products_id' => null,
        'db_products_id' => $dbProductId,
        'ref' => 'total-product',
        'ean13' => '0000000000000',
        'pot' => null,
        'height' => null,
        'price_floor' => 8,
        'price_roll' => 7,
        'price_promo' => 0,
        'producer_id' => null,
        'tva_id' => null,
        'cond' => 2,
        'floor' => 2,
        'roll' => 3,
        'unite' => null,
    ]);

    $payload = cartControllerBuildPdfPayload([
        ['id' => $product->id, 'quantity' => 24],
    ], $user, 0.0);

    expect($payload['items_total'] ?? null)->toBe(168.0)
        ->and($payload['shipping_total'] ?? null)->toBe(300.0)
        ->and($payload['total'] ?? null)->toBe(($payload['items_total'] ?? 0) + ($payload['shipping_total'] ?? 0));
});

/**
 * Business Rules:
 * BR-045
 */
it('uses transport selection from order payload when provided', function (): void {
    $user = User::factory()->create();

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

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-selection',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'country' => 'FR',
        'mod_liv' => 'roll',
        'mini' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_user')->insert([
        'db_product_id' => $dbProductId,
        'user_id' => $user->id,
        'attributes' => json_encode([
            't' => [
                ['carrier_id' => $carrierA->id, 'zone_id' => $zoneA->id],
                ['carrier_id' => $carrierB->id, 'zone_id' => $zoneB->id],
            ],
            'p' => 0,
        ]),
    ]);

    $product = Product::create([
        'sku' => 'selection-product',
        'name' => 'Selection product',
        'description' => null,
        'img_link' => null,
        'price' => 10,
        'active' => true,
        'attributes' => [],
        'category_products_id' => null,
        'db_products_id' => $dbProductId,
        'ref' => 'selection-product',
        'ean13' => '0000000000001',
        'pot' => null,
        'height' => null,
        'price_floor' => 8,
        'price_roll' => 7,
        'price_promo' => 0,
        'producer_id' => null,
        'tva_id' => null,
        'cond' => 2,
        'floor' => 2,
        'roll' => 3,
        'unite' => null,
    ]);

    $payload = cartControllerBuildPdfPayload(
        [
            ['id' => $product->id, 'quantity' => 24],
        ],
        $user,
        0.0,
        [
            $dbProductId => [
                'carrier_id' => $carrierB->id,
                'zone_id' => $zoneB->id,
            ],
        ],
    );

    expect($payload['shipping_total'] ?? null)->toBe(400.0);
});

/**
 * Business Rules:
 * BR-045
 */
it('includes custom minimum lm and tvat in cart payload shipping', function (): void {
    $user = User::factory()->create();

    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'db-product-custom-minimum-shipping',
        'description' => null,
        'champs' => null,
        'categories' => null,
        'country' => 'FR',
        'mod_liv' => 'roll',
        'mini' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('db_product_user')->insert([
        'db_product_id' => $dbProductId,
        'user_id' => $user->id,
        'attributes' => json_encode([
            'p' => 'price_depart',
            'l' => 100,
            'lm' => 300,
            'tvat' => 10,
        ]),
    ]);

    $product = Product::create([
        'sku' => 'custom-minimum-shipping-product',
        'name' => 'Custom minimum shipping product',
        'description' => null,
        'img_link' => null,
        'price' => 10,
        'active' => true,
        'attributes' => [],
        'category_products_id' => null,
        'db_products_id' => $dbProductId,
        'ref' => 'custom-minimum-shipping-product',
        'ean13' => '0000000000002',
        'pot' => null,
        'height' => null,
        'price_floor' => 8,
        'price_roll' => 7,
        'price_promo' => 0,
        'producer_id' => null,
        'tva_id' => null,
        'cond' => 2,
        'floor' => 2,
        'roll' => 3,
        'unite' => null,
    ]);

    $payload = cartControllerBuildPdfPayload([
        ['id' => $product->id, 'quantity' => 24],
    ], $user, 0.0);

    expect($payload['shipping_total'] ?? null)->toBe(330.0)
        ->and($payload['total'] ?? null)->toBe(($payload['items_total'] ?? 0) + 330.0);
});