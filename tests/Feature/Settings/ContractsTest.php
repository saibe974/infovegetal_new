<?php

use App\Models\DbProducts;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

test('contract page is available to a user who can invoice an active database', function () {
    $user = User::factory()->create();
    $dbProduct = DbProducts::query()->create([
        'name' => 'Contract test DB',
        'description' => 'Contract access test',
    ]);

    $user->billingDbProducts()->attach($dbProduct->id, ['active' => true]);

    $this->actingAs($user)
        ->get(route('settings.contracts.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/contracts')
            ->where('auth.can_access_contracts', true));
});

test('contract page is forbidden to a user without a database to invoice', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('settings.contracts.edit'))
        ->assertForbidden();
});

test('an inactive billing assignment does not grant access to the contract page', function () {
    $user = User::factory()->create();
    $dbProduct = DbProducts::query()->create([
        'name' => 'Inactive contract test DB',
        'description' => 'Inactive contract access test',
    ]);

    $user->billingDbProducts()->attach($dbProduct->id, ['active' => false]);

    $this->actingAs($user)
        ->get(route('settings.contracts.edit'))
        ->assertForbidden();
});

test('an administrator can access the contract page of a billing user', function () {
    $admin = User::factory()->create();
    $billingUser = User::factory()->create();
    $admin->assignRole(Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']));

    $dbProduct = DbProducts::query()->create([
        'name' => 'Managed user contract test DB',
        'description' => 'Managed contract access test',
    ]);
    $billingUser->billingDbProducts()->attach($dbProduct->id, ['active' => true]);

    $this->actingAs($admin)
        ->get(route('admin.contracts.edit', ['user' => $billingUser->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/contracts')
            ->where('editingUser.id', $billingUser->id)
            ->where('userAbilities.can_access_contracts', true));
});

test('a managed user without an active billing database has no contract page', function () {
    $admin = User::factory()->create();
    $target = User::factory()->create();
    $admin->assignRole(Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']));

    $this->actingAs($admin)
        ->get(route('admin.contracts.edit', ['user' => $target->id]))
        ->assertForbidden();
});
