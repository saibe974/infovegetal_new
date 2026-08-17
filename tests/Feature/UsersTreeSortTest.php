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
    $last = User::factory()->withoutTwoFactor()->create(['name' => 'Zulu']);
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
        ->assertJsonStructure([
            'items' => [
                '*' => ['id', 'name', 'email', 'created_at', 'roles'],
            ],
        ]);
});
