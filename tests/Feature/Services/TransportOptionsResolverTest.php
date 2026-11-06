<?php

use App\Models\Carrier;
use App\Models\CarrierZone;
use App\Services\TransportOptionsResolver;

it('loads named tariffs for every configured carrier and rejects mismatched zones', function () {
    $first = Carrier::create(['name' => 'First carrier', 'taxgo' => 5]);
    $second = Carrier::create(['name' => 'Second carrier', 'taxgo' => 10]);
    $zoneA = CarrierZone::create(['carrier_id' => $first->id, 'name' => 'North', 'tariffs' => ['mini' => 250, '1-4' => 125, '5' => 100]]);
    $zoneB = CarrierZone::create(['carrier_id' => $second->id, 'name' => 'South', 'tariffs' => ['mini' => 150, '1-3' => 75]]);
    $options = app(TransportOptionsResolver::class)->resolve([1 => ['t' => json_encode([
        ['carrier_id' => $first->id, 'zone_id' => $zoneA->id],
        ['carrier_id' => $second->id, 'zone_id' => $zoneB->id],
        ['carrier_id' => $first->id, 'zone_id' => $zoneB->id],
    ])]]);
    expect($options)->toHaveCount(2)
        ->and($options[$first->id.':'.$zoneA->id]['carrier_name'])->toBe('First carrier')
        ->and($options[$second->id.':'.$zoneB->id]['tariffs']['mini'])->toBe(150)
        ->and(app(TransportOptionsResolver::class)->resolve([1 => ['t' => (string) $first->id, 'z' => $zoneA->id]]))->toHaveCount(1);
});
