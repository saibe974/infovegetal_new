<?php

use App\Models\Carrier;
use App\Models\DbProducts;
use App\Models\User;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $user = User::factory()->withoutTwoFactor()->create();
    $user->assignRole(Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']));
    $this->actingAs($user);
});

it('saves and replaces bases and supplements with the carrier form', function () {
    $ddk = DbProducts::create(['name' => 'DDK']);
    $peplant = DbProducts::create(['name' => 'Peplant']);
    $payload = ['name' => 'Common carrier', 'minimum_delay_hours' => 24, 'order_cutoff_time' => '12:00', 'db_products' => [
        ['id' => $ddk->id, 'supplement_per_roll' => '0'], ['id' => $peplant->id, 'supplement_per_roll' => '10.50'],
    ]];
    $this->post(route('carriers.store', absolute: false), $payload)->assertSessionHasNoErrors();
    $carrier = Carrier::where('name', 'Common carrier')->firstOrFail();
    expect($carrier->supplementsByDb())->toBe([$ddk->id => 0.0, $peplant->id => 10.5]);
    $payload['db_products'] = [['id' => $ddk->id, 'supplement_per_roll' => '2']];
    $this->put(route('carriers.update', $carrier, false), $payload)->assertSessionHasNoErrors();
    expect($carrier->fresh()->supplementsByDb())->toBe([$ddk->id => 2.0]);
});

it('rejects negative supplements and duplicate bases', function () {
    $db = DbProducts::create(['name' => 'DDK']);
    $this->post(route('carriers.store', absolute: false), [
        'name' => 'Invalid', 'minimum_delay_hours' => 24, 'order_cutoff_time' => '12:00',
        'db_products' => [['id' => $db->id, 'supplement_per_roll' => -1], ['id' => $db->id, 'supplement_per_roll' => 0]],
    ])->assertSessionHasErrors(['db_products.0.id', 'db_products.0.supplement_per_roll']);
    expect(Carrier::count())->toBe(0);
});

it('opens the checkout after the obsolete carrier minimum column is removed', function () {
    Carrier::create([
        'name' => 'Checkout carrier',
        'minimum_delay_hours' => 24,
        'order_cutoff_time' => '12:00',
    ]);

    $this->get(route('cart.checkout', absolute: false))
        ->assertOk();
});
