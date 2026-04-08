<?php

use App\Models\User;
use Spatie\Permission\Models\Role;

test('users reorder uses the optimized path when the full tree is submitted', function () {
    /** @var \Tests\TestCase $this */

    $role = Role::create([
        'name' => 'admin',
        'guard_name' => 'web',
    ]);

    $admin = User::factory()->withoutTwoFactor()->create();
    $firstChild = User::factory()->withoutTwoFactor()->create();
    $secondChild = User::factory()->withoutTwoFactor()->create();

    $admin->assignRole($role);

    $admin->saveAsRoot();
    $firstChild->appendToNode($admin)->save();
    $secondChild->appendToNode($admin)->save();

    $response = $this
        ->actingAs($admin)
        ->postJson(route('users.reorder', absolute: false), [
            'items' => [
                ['id' => $admin->id, 'parent_id' => null, 'position' => 0],
                ['id' => $secondChild->id, 'parent_id' => $admin->id, 'position' => 0],
                ['id' => $firstChild->id, 'parent_id' => $admin->id, 'position' => 1],
            ],
        ]);

    $response
        ->assertOk()
        ->assertJson([
            'ok' => true,
            'mode' => 'optimized',
        ]);

    $admin->refresh();
    $firstChild->refresh();
    $secondChild->refresh();

    expect($firstChild->parent_id)->toBe($admin->id);
    expect($secondChild->parent_id)->toBe($admin->id);
    expect($secondChild->_lft)->toBeLessThan($firstChild->_lft);
});