<?php

use App\Models\DbProductBillingUser;
use App\Models\DbProducts;
use App\Models\DbProductSellerUser;
use App\Models\User;
use App\Services\PriceCalculatorService;
use Spatie\Permission\Models\Role;

it('saves supplier contacts with a seller then without a seller and preserves the billing margin', function () {
    $admin = User::factory()->withoutTwoFactor()->create();
    $admin->assignRole(Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']));
    $this->actingAs($admin);
    $client = User::factory()->create();
    $billing = User::factory()->create();
    $seller = User::factory()->create();
    $db = DbProducts::create(['name' => 'Supplier']);
    DbProductBillingUser::create(['db_product_id' => $db->id, 'billing_user_id' => $billing->id, 'active' => true,
        'defaults' => ['profiles' => [['id' => 'standard', 'name' => 'Standard', 'conditions' => ['m' => 10]]], 'default_profile_id' => 'standard']]);
    DbProductSellerUser::create(['db_product_id' => $db->id, 'billing_user_id' => $billing->id, 'seller_user_id' => $seller->id, 'active' => true, 'seller_defaults' => ['m' => 5]]);
    $save = function (?int $sellerId, array $override) use ($client, $billing, $db) {
        return $this->post(route('users.editDb', $client, false), [
            'db_ids' => [$db->id], 'sales_conditions' => [[
                'db_product_id' => $db->id, 'billing_user_id' => $billing->id,
                'seller_user_id' => $sellerId, 'conditions_override' => $override,
            ]],
        ])->assertSessionHasNoErrors()->assertRedirect();
    };
    $save($seller->id, []);
    $save(null, ['m' => 25]);
    $active = $client->clientSalesConditions()->where('active', true)->get();
    expect($active)->toHaveCount(1)
        ->and($active->first()->seller_user_id)->toBeNull()
        ->and($active->first()->conditions_override)->toBe(['m' => 25]);
    $attrs = json_decode($client->dbProducts()->first()->pivot->attributes, true);
    expect($attrs['fact'])->toBe($billing->id)->and($attrs['com'])->toBeNull();
    expect(app(PriceCalculatorService::class)->resolveUserAttributes($client, $db->id)['m'])->toBe(25);
    // Legacy contacts cannot restore a removed seller or select another billing user.
    $client->dbProducts()->updateExistingPivot($db->id, ['attributes' => json_encode(['fact' => 999, 'com' => $seller->id])]);
    expect(app(PriceCalculatorService::class)->resolveUserAttributes($client, $db->id)['m'])->toBe(25);
    $save($seller->id, []);
    expect($client->clientSalesConditions()->where('active', true)->sole()->seller_user_id)->toBe($seller->id);
});
