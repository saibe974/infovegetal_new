<?php

use App\Models\LoginLog;
use App\Models\User;
use Spatie\Permission\Models\Role;

test('guests cannot access the recent logins widget', function () {
    $this->getJson(route('api.recent-logins-widget.index'))->assertUnauthorized();
});

test('users without the required roles are forbidden', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson(route('api.recent-logins-widget.index'))
        ->assertForbidden();
});

test('commercial users can access the widget', function () {
    $commercial = User::factory()->create();
    $commercial->assignRole(Role::firstOrCreate(['name' => 'commercial', 'guard_name' => 'web']));

    $other = User::factory()->create();
    LoginLog::create([
        'user_id' => $other->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'PHPUnit',
        'login_at' => now(),
    ]);

    $response = $this->actingAs($commercial)
        ->getJson(route('api.recent-logins-widget.index'))
        ->assertOk();

    expect($response->json('items'))->toHaveCount(1);
    expect($response->json('items.0.user.id'))->toBe($other->id);
    expect($response->json('items.0.ip_address'))->toBe('127.0.0.1');
    expect($response->json('total'))->toBe(1);
});

test('the widget returns at most 10 logins ordered by most recent', function () {
    $admin = User::factory()->create();
    $admin->assignRole(Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']));

    $other = User::factory()->create();

    foreach (range(1, 12) as $i) {
        LoginLog::create([
            'user_id' => $other->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'login_at' => now()->addMinutes($i),
        ]);
    }

    $response = $this->actingAs($admin)
        ->getJson(route('api.recent-logins-widget.index'))
        ->assertOk();

    expect($response->json('items'))->toHaveCount(10);

    $dates = collect($response->json('items'))->pluck('login_at');
    for ($i = 1; $i < $dates->count(); $i++) {
        expect($dates[$i - 1] >= $dates[$i])->toBeTrue();
    }
});