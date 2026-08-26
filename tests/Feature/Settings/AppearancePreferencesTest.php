<?php

use App\Models\User;
use App\Services\UserMetaSyncService;
use Inertia\Testing\AssertableInertia as Assert;

function appearancePreferencesPayload(array $overrides = []): array
{
    return array_replace_recursive([
        'version' => 1,
        'general' => [
            'theme' => 'dark',
            'accent' => 'green',
            'density' => 'compact',
        ],
        'pages' => [
            'products' => [
                'enabled' => true,
                'view' => 'grid',
                'rightSidebarOpen' => true,
            ],
            'users' => [
                'enabled' => false,
                'view' => 'accordion',
                'rightSidebarOpen' => false,
            ],
        ],
    ], $overrides);
}

test('appearance preferences page is displayed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('settings.appearance.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/appearance')
            ->where('editingUser.id', $user->id)
            ->where('appearancePreferences', null));
});

test('appearance preferences can be stored on the user account', function () {
    $user = User::factory()->create();
    $preferences = appearancePreferencesPayload();

    $this->actingAs($user)
        ->putJson(route('settings.appearance.update'), $preferences)
        ->assertOk()
        ->assertJsonPath('preferences.general.theme', 'dark');

    $meta = $user->usersMeta()->where('key', 'appearance_preferences')->firstOrFail();

    expect($meta->type)->toBe('json')
        ->and(json_decode($meta->value, true))->toBe($preferences);
});

test('appearance preferences reject unsupported display values', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->putJson(route('settings.appearance.update'), appearancePreferencesPayload([
            'general' => ['accent' => 'rainbow'],
            'pages' => ['products' => ['view' => 'carousel']],
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['general.accent', 'pages.products.view']);
});

test('account appearance preferences are shared with inertia pages', function () {
    $user = User::factory()->create();
    $preferences = appearancePreferencesPayload();
    $user->usersMeta()->create([
        'key' => 'appearance_preferences',
        'title' => 'Préférences d’affichage',
        'value' => json_encode($preferences),
        'type' => 'json',
    ]);

    $this->actingAs($user)
        ->get(route('settings.appearance.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('appearancePreferences', $preferences));
});

test('profile metadata synchronization preserves appearance preferences', function () {
    $user = User::factory()->create();
    $user->usersMeta()->create([
        'key' => 'appearance_preferences',
        'title' => 'Préférences d’affichage',
        'value' => json_encode(appearancePreferencesPayload()),
        'type' => 'json',
    ]);

    app(UserMetaSyncService::class)->sync($user, []);

    expect($user->usersMeta()->where('key', 'appearance_preferences')->exists())->toBeTrue();
});
