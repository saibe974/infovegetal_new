<?php

use App\Domain\Sales\Services\TransportDeparturePricingService;
use App\Models\Carrier;
use App\Models\DbProducts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(Tests\TestCase::class, RefreshDatabase::class);

function sharedCarrierFixture(float $minimum = 0, float $taxgo = 0): array
{
    $ddk = DbProducts::create(['name' => 'DDK']);
    $peplant = DbProducts::create(['name' => 'Peplant']);
    $carrier = Carrier::create(['name' => 'Common carrier', 'taxgo' => $taxgo]);
    $carrier->dbProducts()->attach([$ddk->id => ['supplement_per_roll' => 0], $peplant->id => ['supplement_per_roll' => 10]]);
    $zone = $carrier->zones()->create(['name' => 'Common zone', 'tariffs' => ['mini' => $minimum, 'roll:1-4' => 60, 'roll:5' => 40]]);
    $distribution = ['suppliers' => [
        ['supplier_id' => $ddk->id, 'mod_liv' => 'roll', 'rolls' => array_fill(0, 3, ['coef' => 1])],
        ['supplier_id' => $peplant->id, 'mod_liv' => 'roll', 'rolls' => array_fill(0, 2, ['coef' => 1])],
    ]];
    $attrs = array_fill_keys([$ddk->id, $peplant->id], ['t' => $carrier->id, 'z' => $zone->id, 'p' => 0]);

    return [$carrier, $zone, $ddk, $peplant, $distribution, $attrs];
}

it('uses five rolls for the common tier and adds only the Peplant supplement', function () {
    [$carrier, $zone, $ddk, $peplant, $distribution, $attrs] = sharedCarrierFixture();
    $result = (new TransportDeparturePricingService)->calculateBreakdown($distribution, $attrs);
    expect($result['total'])->toBe(220.0)
        ->and($result['by_db'])->toBe([$ddk->id => 120.0, $peplant->id => 100.0])
        ->and($result['groups'])->toHaveCount(1);
});

it('applies one minimum then supplements and gasoil', function () {
    [, , $ddk, $peplant, $distribution, $attrs] = sharedCarrierFixture(300, 10);
    $result = (new TransportDeparturePricingService)->calculateBreakdown($distribution, $attrs);
    expect($result['total'])->toBe(352.0)
        ->and($result['by_db'])->toBe([$ddk->id => 198.0, $peplant->id => 154.0]);
});

it('keeps different zones separate even for the same carrier', function () {
    [$carrier, , , $peplant, $distribution, $attrs] = sharedCarrierFixture();
    $otherZone = $carrier->zones()->create(['name' => 'Other zone', 'tariffs' => ['roll:1' => 70]]);
    $attrs[$peplant->id]['z'] = $otherZone->id;
    $result = (new TransportDeparturePricingService)->calculateBreakdown($distribution, $attrs);
    expect($result['total'])->toBe(340.0)->and($result['groups'])->toHaveCount(2);
});

it('deducts rendered transport but still charges the supplement', function () {
    [, , $ddk, $peplant, $distribution, $attrs] = sharedCarrierFixture();
    $attrs[$ddk->id]['p'] = 1;
    $attrs[$peplant->id]['p'] = 1;
    $distribution['suppliers'][1]['rolls'][1]['coef'] = 0.5;
    expect((new TransportDeparturePricingService)->calculate($distribution, $attrs))->toBe(40.0);
});

it('supports mixed departure and rendered bases with one minimum', function () {
    [, , $ddk, , $distribution, $attrs] = sharedCarrierFixture(300);
    $attrs[$ddk->id]['p'] = 1;
    expect((new TransportDeparturePricingService)->calculate($distribution, $attrs))->toBe(200.0);
});

it('rejects a detached base instead of silently making its transport free', function () {
    [$carrier, , , $peplant, $distribution, $attrs] = sharedCarrierFixture();
    $carrier->dbProducts()->detach($peplant->id);
    expect(fn () => (new TransportDeparturePricingService)->calculate($distribution, $attrs))->toThrow(ValidationException::class);
});

it('rejects a zone belonging to another carrier', function () {
    [, , $ddk, , $distribution, $attrs] = sharedCarrierFixture();
    $other = Carrier::create(['name' => 'Other carrier']);
    $zone = $other->zones()->create(['name' => 'Other', 'tariffs' => ['roll:1' => 1]]);
    $attrs[$ddk->id]['z'] = $zone->id;
    expect(fn () => (new TransportDeparturePricingService)->calculate($distribution, $attrs))->toThrow(ValidationException::class);
});
