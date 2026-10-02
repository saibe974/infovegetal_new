<?php

use App\Mail\LoginAlertMail;
use App\Models\LoginLog;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Spatie\Permission\Models\Role;

test('a successful login is recorded', function () {
    $user = User::factory()->create();

    Auth::login($user);

    expect(LoginLog::query()->where('user_id', $user->id)->count())->toBe(1);

    $log = LoginLog::query()->where('user_id', $user->id)->first();
    expect($log->login_at)->not->toBeNull();
    expect($log->ip_address)->toBe('127.0.0.1');
});

test('impersonated logins are not recorded', function () {
    $impersonator = User::factory()->create();
    $target = User::factory()->create();

    // Flux réel du package laravel-impersonate : quietLogin (aucun événement Login).
    expect(app('impersonate')->take($impersonator, $target))->toBeTrue();

    expect(LoginLog::query()->count())->toBe(0);
    expect(Auth::user()?->id)->toBe($target->id);

    // Retour à l'impersonateur : quietLogin, toujours aucun événement.
    expect(app('impersonate')->leave())->toBeTrue();

    expect(LoginLog::query()->count())->toBe(0);
    expect(Auth::user()?->id)->toBe($impersonator->id);
});

test('opted-in admins receive a login alert email', function () {
    Mail::fake();

    $watcher = User::factory()->create();
    $watcher->assignRole(Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']));
    $watcher->usersMeta()->create([
        'key' => 'login_alert',
        'title' => 'Alerte connexion',
        'value' => '1',
        'type' => 'boolean',
        'sort_order' => 0,
    ]);

    $user = User::factory()->create();
    Auth::login($user);

    Mail::assertSent(LoginAlertMail::class, 1);
    Mail::assertSent(LoginAlertMail::class, fn (LoginAlertMail $mail) => $mail->hasTo($watcher->email));
});

test('users without opt-in receive no alert', function () {
    Mail::fake();

    $watcher = User::factory()->create();
    $watcher->assignRole(Role::firstOrCreate(['name' => 'commercial', 'guard_name' => 'web']));

    $user = User::factory()->create();
    Auth::login($user);

    Mail::assertNothingSent();
});

test('the login user is not notified about their own login', function () {
    Mail::fake();

    $user = User::factory()->create();
    $user->assignRole(Role::firstOrCreate(['name' => 'dev', 'guard_name' => 'web']));
    $user->usersMeta()->create([
        'key' => 'login_alert',
        'title' => 'Alerte connexion',
        'value' => '1',
        'type' => 'boolean',
        'sort_order' => 0,
    ]);

    Auth::login($user);

    Mail::assertNothingSent();
});

test('alerts are throttled per recipient and user', function () {
    Mail::fake();

    $watcher = User::factory()->create();
    $watcher->assignRole(Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']));
    $watcher->usersMeta()->create([
        'key' => 'login_alert',
        'title' => 'Alerte connexion',
        'value' => '1',
        'type' => 'boolean',
        'sort_order' => 0,
    ]);

    $user = User::factory()->create();

    Auth::login($user);
    Auth::logout();
    Auth::login($user);

    Mail::assertSent(LoginAlertMail::class, 1);
    expect(LoginLog::query()->count())->toBe(2);
});