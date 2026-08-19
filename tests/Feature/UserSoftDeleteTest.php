<?php

use App\Models\File;
use App\Models\User;
use Spatie\Permission\Models\Role;

test('an admin archives a user without deleting their files', function () {
    /** @var \Tests\TestCase $this */
    $adminRole = Role::create([
        'name' => 'admin',
        'guard_name' => 'web',
    ]);

    $admin = User::factory()->withoutTwoFactor()->create();
    $target = User::factory()->withoutTwoFactor()->create();

    $admin->assignRole($adminRole);
    $admin->saveAsRoot();
    $target->saveAsRoot();

    $file = File::query()->create([
        'user_id' => $target->id,
        'file_name' => 'document.pdf',
        'file_path' => 'files/document.pdf',
        'file_size' => 1024,
    ]);

    $this
        ->actingAs($admin)
        ->delete(route('users.destroy', ['user' => $target->id], false))
        ->assertRedirect(route('users.index', absolute: false));

    $this->assertSoftDeleted('users', ['id' => $target->id]);
    $this->assertDatabaseHas('files', [
        'id' => $file->id,
        'user_id' => $target->id,
    ]);

    expect(User::find($target->id))->toBeNull()
        ->and(User::withTrashed()->find($target->id))->not->toBeNull();
});

test('archiving a parent also archives its descendants', function () {
    $parent = User::factory()->withoutTwoFactor()->create();
    $child = User::factory()->withoutTwoFactor()->create();

    $parent->saveAsRoot();
    $child->appendToNode($parent)->save();

    $parent->delete();

    expect($parent->fresh()->trashed())->toBeTrue()
        ->and($child->fresh()->trashed())->toBeTrue();
});

test('an archived user can no longer authenticate', function () {
    /** @var \Tests\TestCase $this */
    $user = User::factory()->withoutTwoFactor()->create();
    $user->saveAsRoot();
    $user->delete();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});
