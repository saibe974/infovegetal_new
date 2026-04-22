<?php

use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

function contractRole(string $roleName, array $permissionNames = []): Role
{
    $role = Role::firstOrCreate([
        'name' => $roleName,
        'guard_name' => 'web',
    ]);

    $permissions = collect($permissionNames)
        ->map(fn (string $permissionName) => Permission::firstOrCreate([
            'name' => $permissionName,
            'guard_name' => 'web',
        ]));

    if ($permissions->isNotEmpty()) {
        $role->syncPermissions($permissions);
    }

    return $role;
}

function updatePayload(User $user, array $extra = []): array
{
    return array_merge([
        'name' => $user->name,
        'alias' => $user->alias,
        'ref' => $user->ref,
        'phone' => $user->phone,
        'address_road' => $user->address_road,
        'address_zip' => $user->address_zip,
        'address_town' => $user->address_town,
        'email' => $user->email,
    ], $extra);
}

test('users.update.branch authorizes descendants only', function () {
    /** @var \Tests\TestCase $this */

    $managerRole = contractRole('manager-update-branch', ['users.view.branch', 'users.update.branch']);

    $manager = User::factory()->withoutTwoFactor()->create();
    $descendant = User::factory()->withoutTwoFactor()->create();
    $outsider = User::factory()->withoutTwoFactor()->create();

    $manager->assignRole($managerRole);

    $manager->saveAsRoot();
    $descendant->appendToNode($manager)->save();
    $outsider->saveAsRoot();

    $this->actingAs($manager)
        ->put(route('users.update', ['user' => $descendant->id], false), updatePayload($descendant))
        ->assertRedirect();

    $this->actingAs($manager)
        ->put(route('users.update', ['user' => $outsider->id], false), updatePayload($outsider))
        ->assertForbidden();
});

test('users.update.all does not allow updating an ancestor', function () {
    /** @var \Tests\TestCase $this */

    $allRole = contractRole('manager-update-all', ['users.update.all']);

    $ancestor = User::factory()->withoutTwoFactor()->create();
    $actor = User::factory()->withoutTwoFactor()->create();

    $actor->assignRole($allRole);

    $ancestor->saveAsRoot();
    $actor->appendToNode($ancestor)->save();

    $this->actingAs($actor)
        ->put(route('users.update', ['user' => $ancestor->id], false), updatePayload($ancestor))
        ->assertForbidden();
});

test('users.assign_permissions cannot delegate non delegable permissions', function () {
    /** @var \Tests\TestCase $this */

    $managerRole = contractRole('manager-assign-perms', ['users.assign_permissions.all']);

    $manager = User::factory()->withoutTwoFactor()->create();
    $target = User::factory()->withoutTwoFactor()->create();

    $manager->assignRole($managerRole);
    $manager->saveAsRoot();
    $target->appendToNode($manager)->save();

    $nonDelegable = Permission::firstOrCreate([
        'name' => 'users.impersonate.all',
        'guard_name' => 'web',
    ]);

    $this->actingAs($manager)
        ->put(route('users.update', ['user' => $target->id], false), updatePayload($target, [
            'permissions' => [$nonDelegable->id],
        ]))
        ->assertForbidden();
});

test('users.create.branch requires a strict descendant parent', function () {
    /** @var \Tests\TestCase $this */

    $creatorRole = contractRole('creator-branch', ['users.create.branch']);
    $clientRole = contractRole('client-contract');

    $actor = User::factory()->withoutTwoFactor()->create();
    $childParent = User::factory()->withoutTwoFactor()->create();

    $actor->assignRole($creatorRole);

    $actor->saveAsRoot();
    $childParent->appendToNode($actor)->save();

    $this->actingAs($actor)
        ->post(route('users.store', [], false), [
            'name' => 'Child under branch',
            'email' => 'child-branch@example.test',
            'password' => 'password123',
            'roles' => [$clientRole->id],
            'parent_id' => $childParent->id,
        ])
        ->assertRedirect();

    $this->actingAs($actor)
        ->post(route('users.store', [], false), [
            'name' => 'Child under self should fail',
            'email' => 'child-self@example.test',
            'password' => 'password123',
            'roles' => [$clientRole->id],
            'parent_id' => $actor->id,
        ])
        ->assertForbidden();
});

test('impersonation cannot target protected accounts', function () {
    /** @var \Tests\TestCase $this */

    $impersonatorRole = contractRole('impersonator-all', ['users.impersonate.all']);
    $adminRole = contractRole('admin');

    $actor = User::factory()->withoutTwoFactor()->create();
    $protectedTarget = User::factory()->withoutTwoFactor()->create();

    $actor->assignRole($impersonatorRole);
    $protectedTarget->assignRole($adminRole);

    $actor->saveAsRoot();
    $protectedTarget->saveAsRoot();

    expect($actor->can('impersonate', $protectedTarget))->toBeFalse();

    $this->actingAs($actor)
        ->get(route('impersonate', ['id' => $protectedTarget->id], false))
        ->assertForbidden();
});

test('impersonated effective user remains bounded by real actor scope', function () {
    /** @var \Tests\TestCase $this */

    $realActorRole = contractRole('real-actor-impersonate-branch', ['users.impersonate.branch', 'users.update.branch']);
    $targetRole = contractRole('target-update-all', ['users.update.all']);

    $realActor = User::factory()->withoutTwoFactor()->create();
    $target = User::factory()->withoutTwoFactor()->create();
    $outsider = User::factory()->withoutTwoFactor()->create();

    $realActor->assignRole($realActorRole);
    $target->assignRole($targetRole);

    $realActor->saveAsRoot();
    $target->appendToNode($realActor)->save();
    $outsider->saveAsRoot();

    $this->actingAs($realActor)
        ->get(route('impersonate', ['id' => $target->id], false))
        ->assertRedirect();

    $this->put(route('users.update', ['user' => $outsider->id], false), updatePayload($outsider))
        ->assertForbidden();
});
