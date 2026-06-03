<?php

use App\Models\Carrier;
use App\Models\CarrierZone;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Spatie\Permission\Models\Role;

test('an admin can import carrier zones from a csv file', function () {
    /** @var \Tests\TestCase $this */

    $adminRole = Role::create([
        'name' => 'admin',
        'guard_name' => 'web',
    ]);

    $admin = User::factory()->withoutTwoFactor()->create();
    $admin->assignRole($adminRole);

    $carrier = Carrier::create([
        'name' => 'Carrier CSV',
        'country' => 'FR',
        'days' => null,
        'minimum' => null,
        'taxgo' => null,
    ]);

    CarrierZone::create([
        'carrier_id' => $carrier->id,
        'name' => 'Old zone',
        'tariffs' => ['mini' => '1.00'],
    ]);

    $file = UploadedFile::fake()->createWithContent('zones.csv', <<<CSV
zone,mini,1,2
Zone A,5,10,20
Zone B,7,11,
CSV);

    $response = $this
        ->actingAs($admin)
        ->post(route('carriers.zones.import', ['carrier' => $carrier->id], false), [
            'file' => $file,
        ]);

    $response
        ->assertOk()
        ->assertJson([
            'message' => 'Zones importées.',
        ]);

    $carrier->refresh()->load('zones');

    expect($carrier->zones)->toHaveCount(2);
    expect($carrier->zones->pluck('name')->all())->toBe(['Zone A', 'Zone B']);
    expect($carrier->zones[0]->tariffs)->toBe([
        'mini' => '5',
        'roll:1' => '10',
        'roll:2' => '20',
    ]);
    expect($carrier->zones[1]->tariffs)->toBe([
        'mini' => '7',
        'roll:1' => '11',
    ]);
    expect(CarrierZone::where('name', 'Old zone')->exists())->toBeFalse();
});