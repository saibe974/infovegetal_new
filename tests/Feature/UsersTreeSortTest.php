<?php

use App\Models\User;
use Spatie\Permission\Models\Role;

test('users tree children can be sorted and include the table columns', function () {
    /** @var \Tests\TestCase $this */

    $adminRole = Role::create([
        'name' => 'admin',
        'guard_name' => 'web',
    ]);

    $admin = User::factory()->withoutTwoFactor()->create(['name' => 'Manager']);
    $last = User::factory()->withoutTwoFactor()->create([
        'name' => 'Zulu',
        'alias' => 'Z',
        'ref' => 'REF-Z',
        'phone' => '555-0102',
        'address_town' => 'Curepipe',
    ]);
    $first = User::factory()->withoutTwoFactor()->create(['name' => 'Alpha']);

    $admin->assignRole($adminRole);
    $admin->saveAsRoot();
    $last->appendToNode($admin)->save();
    $first->appendToNode($admin)->save();

    $response = $this
        ->actingAs($admin)
        ->getJson(route('users.tree-children', [
            'parent_id' => $admin->id,
            'sort' => 'name',
            'dir' => 'asc',
        ], false));

    $response
        ->assertOk()
        ->assertJsonPath('items.0.id', $first->id)
        ->assertJsonPath('items.0.name', 'Alpha')
        ->assertJsonPath('items.1.id', $last->id)
        ->assertJsonPath('items.1.alias', 'Z')
        ->assertJsonPath('items.1.ref', 'REF-Z')
        ->assertJsonPath('items.1.phone', '555-0102')
        ->assertJsonPath('items.1.address_town', 'Curepipe')
        ->assertJsonPath('items.1.abilities.manage_db', true)
        ->assertJsonStructure([
            'items' => [
                '*' => [
                    'id',
                    'name',
                    'alias',
                    'ref',
                    'email',
                    'phone',
                    'address_road',
                    'address_zip',
                    'address_town',
                    'created_at',
                    'roles',
                ],
            ],
        ]);
});
