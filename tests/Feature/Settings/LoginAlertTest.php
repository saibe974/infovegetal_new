<?php

use App\Http\Controllers\Settings\LoginAlertController;
use App\Models\User;
use Spatie\Permission\Models\Role;

function roleFor(string $name): Role
{
    return Role::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
}

test('eligible users can enable login alerts', function () {
    $user = User::factory()->create();
    $user->assignRole(roleFor('dev'));

    $this->actingAs($user)
        ->putJson(route('settings.login-alert.update'), ['enabled' => true])
        ->assertOk()
        ->assertJson(['loginAlert' => true]);

    expect(LoginAlertController::enabledFor($user->fresh()))->toBeTrue();
});

test('eligible users can disable login alerts', function () {
    $user = User::factory()->create();
    $user->assignRole(roleFor('admin'));
    $user->usersMeta()->create([
        'key' => 'login_alert',
        'title' => 'Alerte connexion',
        'value' => '1',
        'type' => 'boolean',
        'sort_order' => 0,
    ]);

    $this->actingAs($user)
        ->putJson(route('settings.login-alert.update'), ['enabled' => false])
        ->assertOk()
        ->assertJson(['loginAlert' => false]);

    expect(LoginAlertController::enabledFor($user->fresh()))->toBeFalse();
});

test('non eligible users are forbidden', function () {
    $user = User::factory()->create();
    $user->assignRole(roleFor('client'));

    $this->actingAs($user)
        ->putJson(route('settings.login-alert.update'), ['enabled' => true])
        ->assertForbidden();

    expect(LoginAlertController::enabledFor($user->fresh()))->toBeFalse();
});

test('validation rejects missing enabled value', function () {
    $user = User::factory()->create();
    $user->assignRole(roleFor('commercial'));

    $this->actingAs($user)
        ->putJson(route('settings.login-alert.update'), [])
        ->assertStatus(422);
});