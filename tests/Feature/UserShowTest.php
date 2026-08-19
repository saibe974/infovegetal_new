<?php

use App\Models\User;
use App\Models\UserMeta;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

test('a user with view access can open the read-only user overview', function () {
    /** @var \Tests\TestCase $this */
    $viewPermission = Permission::create([
        'name' => 'users.view.branch',
        'guard_name' => 'web',
    ]);
    $managerRole = Role::create([
        'name' => 'viewer',
        'guard_name' => 'web',
    ]);
    $managerRole->givePermissionTo($viewPermission);

    $manager = User::factory()->withoutTwoFactor()->create();
    $target = User::factory()->withoutTwoFactor()->create([
        'alias' => 'Client principal',
        'ref' => 'CLI-42',
        'phone' => '+230 5555 0101',
        'address_town' => 'Port-Louis',
    ]);

    $manager->assignRole($managerRole);
    $manager->saveAsRoot();
    $target->appendToNode($manager)->save();
    UserMeta::create([
        'user_id' => $target->id,
        'key' => 'billing_address',
        'title' => 'Adresse de facturation',
        'value' => '{"road":"Royal Road","town":"Port-Louis"}',
        'type' => 'json',
        'sort_order' => 10,
    ]);

    $this
        ->actingAs($manager)
        ->get(route('users.show', ['user' => $target->id], false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('users/show')
            ->where('user.id', $target->id)
            ->where('user.alias', 'Client principal')
            ->where('user.abilities.view', true)
            ->where('user.abilities.update', false)
            ->where('user.abilities.manage_db', false)
            ->where('parent.id', $manager->id)
            ->where('childrenCount', 0)
            ->has('userMeta', 1)
            ->where('userMeta.0.key', 'billing_address')
            ->where('userMeta.0.title', 'Adresse de facturation'));

    $this
        ->actingAs($manager)
        ->get(route('users.edit', ['user' => $target->id], false))
        ->assertForbidden();
});

test('a user cannot view an overview outside their manageable branch', function () {
    /** @var \Tests\TestCase $this */
    $viewPermission = Permission::create([
        'name' => 'users.view.branch',
        'guard_name' => 'web',
    ]);
    $managerRole = Role::create([
        'name' => 'viewer',
        'guard_name' => 'web',
    ]);
    $managerRole->givePermissionTo($viewPermission);

    $manager = User::factory()->withoutTwoFactor()->create();
    $outside = User::factory()->withoutTwoFactor()->create();
    $manager->assignRole($managerRole);
    $manager->saveAsRoot();
    $outside->saveAsRoot();

    $this
        ->actingAs($manager)
        ->get(route('users.show', ['user' => $outside->id], false))
        ->assertForbidden();
});
