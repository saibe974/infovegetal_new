<?php

use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

function createRoleWithPermissions(string $roleName, array $permissionNames = []): Role
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

test('a branch manager can manage descendants but not ancestors or users outside the branch', function () {
    $supplierRole = createRoleWithPermissions('supplier');
    $commercialRole = createRoleWithPermissions('commercial', ['manage users', 'create clients']);
    $clientRole = createRoleWithPermissions('client');

    $supplier = User::factory()->withoutTwoFactor()->create();
    $commercial = User::factory()->withoutTwoFactor()->create();
    $client = User::factory()->withoutTwoFactor()->create();
    $outsider = User::factory()->withoutTwoFactor()->create();

    $supplier->assignRole($supplierRole);
    $commercial->assignRole($commercialRole);
    $client->assignRole($clientRole);

    $supplier->saveAsRoot();
    $commercial->appendToNode($supplier)->save();
    $client->appendToNode($commercial)->save();
    $outsider->saveAsRoot();

    expect($commercial->can('viewAny', User::class))->toBeTrue();
    expect($commercial->can('view', $client))->toBeTrue();
    expect($commercial->can('update', $client))->toBeTrue();
    expect($commercial->can('view', $supplier))->toBeFalse();
    expect($commercial->can('update', $supplier))->toBeFalse();
    expect($commercial->can('view', $outsider))->toBeFalse();
    expect($commercial->can('update', $outsider))->toBeFalse();
});

test('a branch manager can create allowed roles only inside its own branch', function () {
    $commercialRole = createRoleWithPermissions('commercial', ['manage users', 'create clients']);
    createRoleWithPermissions('client');
    createRoleWithPermissions('admin');

    $commercial = User::factory()->withoutTwoFactor()->create();
    $descendantParent = User::factory()->withoutTwoFactor()->create();
    $outsideParent = User::factory()->withoutTwoFactor()->create();

    $commercial->assignRole($commercialRole);

    $commercial->saveAsRoot();
    $descendantParent->appendToNode($commercial)->save();
    $outsideParent->saveAsRoot();

    expect($commercial->can('create', [User::class, $commercial, ['client']]))->toBeTrue();
    expect($commercial->can('create', [User::class, $descendantParent, ['client']]))->toBeTrue();
    expect($commercial->can('create', [User::class, null, ['client']]))->toBeFalse();
    expect($commercial->can('create', [User::class, $outsideParent, ['client']]))->toBeFalse();
    expect($commercial->can('create', [User::class, $commercial, ['admin']]))->toBeFalse();
});

test('a dev cannot assign a protected role through the update endpoint', function () {
    /** @var \Tests\TestCase $this */

    $devRole = createRoleWithPermissions('dev');
    $commercialRole = createRoleWithPermissions('commercial');
    $adminRole = createRoleWithPermissions('admin');

    $dev = User::factory()->withoutTwoFactor()->create();
    $target = User::factory()->withoutTwoFactor()->create();

    $dev->assignRole($devRole);
    $target->assignRole($commercialRole);

    $dev->saveAsRoot();
    $target->appendToNode($dev)->save();

    $response = $this
        ->actingAs($dev)
        ->put(route('users.update', ['user' => $target->id], false), [
            'name' => $target->name,
            'alias' => $target->alias,
            'ref' => $target->ref,
            'phone' => $target->phone,
            'address_road' => $target->address_road,
            'address_zip' => $target->address_zip,
            'address_town' => $target->address_town,
            'email' => $target->email,
            'roles' => [$adminRole->id],
        ]);

    $response->assertForbidden();
});

test('an admin cannot remove its own admin role through the update endpoint', function () {
    /** @var \Tests\TestCase $this */

    $adminRole = createRoleWithPermissions('admin');
    $clientRole = createRoleWithPermissions('client');

    $admin = User::factory()->withoutTwoFactor()->create();

    $admin->assignRole($adminRole);
    $admin->saveAsRoot();

    $response = $this
        ->actingAs($admin)
        ->put(route('users.update', ['user' => $admin->id], false), [
            'name' => $admin->name,
            'alias' => $admin->alias,
            'ref' => $admin->ref,
            'phone' => $admin->phone,
            'address_road' => $admin->address_road,
            'address_zip' => $admin->address_zip,
            'address_town' => $admin->address_town,
            'email' => $admin->email,
            'roles' => [$clientRole->id],
        ]);

    $response->assertForbidden();
});

test('a user with commercial creation rights can access the users tree for its own branch', function () {
    createRoleWithPermissions('client');
    $commercialRole = createRoleWithPermissions('commercial-tree-only', ['create clients']);

    $commercial = User::factory()->withoutTwoFactor()->create();
    $client = User::factory()->withoutTwoFactor()->create();
    $outsider = User::factory()->withoutTwoFactor()->create();

    $commercial->assignRole($commercialRole);

    $commercial->saveAsRoot();
    $client->appendToNode($commercial)->save();
    $outsider->saveAsRoot();

    expect($commercial->can('viewAny', User::class))->toBeTrue();
    expect($commercial->can('view', $client))->toBeTrue();
    expect($commercial->can('view', $outsider))->toBeFalse();
});