<?php

use App\Domain\Promotions\Enums\PromotionStatus;
use App\Models\Promotion;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

function promotionUserWithRole(string $roleName): User
{
    $role = Role::firstOrCreate([
        'name' => $roleName,
        'guard_name' => 'web',
    ]);

    $user = User::factory()->withoutTwoFactor()->create();
    $user->assignRole($role);

    return $user;
}

function makePromotion(User $creator, array $attributes = []): Promotion
{
    return Promotion::create(array_merge([
        'title' => 'Promotion test',
        'slug' => 'promotion-test-'.fake()->unique()->numberBetween(1, 999999),
        'status' => PromotionStatus::Draft,
        'visibility' => 'targeted',
        'created_by_id' => $creator->id,
        'responsible_user_id' => $creator->id,
    ], $attributes));
}

test('a commercial can open the promotion workspace and create a draft', function () {
    $commercial = promotionUserWithRole('commercial');

    $this->actingAs($commercial)
        ->get(route('promotions.create', [], false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('promotions/general')
            ->where('promotion', null)
            ->has('managerOptions', 1));

    $response = $this->actingAs($commercial)
        ->post(route('promotions.store', [], false), [
            'title' => 'Offre de printemps',
            'slug' => '',
            'description' => 'Sélection de lancement.',
            'responsible_user_id' => $commercial->id,
            'visibility' => 'targeted',
            'starts_at' => '2026-09-01 08:00:00',
            'ends_at' => '2026-09-30 18:00:00',
        ]);

    $promotion = Promotion::query()->sole();

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('promotions.edit.general', $promotion, false));

    expect($promotion->slug)->toBe('offre-de-printemps')
        ->and($promotion->created_by_id)->toBe($commercial->id)
        ->and($promotion->status)->toBe(PromotionStatus::Draft);
});

test('promo.manage grants management without granting global scope', function () {
    $permission = Permission::firstOrCreate([
        'name' => 'promo.manage',
        'guard_name' => 'web',
    ]);
    $manager = User::factory()->withoutTwoFactor()->create();
    $manager->givePermissionTo($permission);
    $outsider = promotionUserWithRole('commercial');

    $ownPromotion = makePromotion($manager, ['title' => 'Visible promotion']);
    makePromotion($outsider, ['title' => 'Hidden promotion']);

    $this->actingAs($manager)
        ->get(route('promotions.index', [], false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('promotions/index')
            ->has('collection.data', 1)
            ->where('collection.data.0.id', $ownPromotion->id));
});

test('an admin can see every promotion and assign an eligible responsible user', function () {
    $admin = promotionUserWithRole('admin');
    $commercial = promotionUserWithRole('commercial');
    makePromotion($commercial);

    $this->actingAs($admin)
        ->get(route('promotions.index', [], false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('collection.data', 1));

    $this->actingAs($admin)
        ->post(route('promotions.store', [], false), [
            'title' => 'Promotion administrateur',
            'slug' => 'promotion-administrateur',
            'description' => null,
            'responsible_user_id' => $commercial->id,
            'visibility' => 'public',
            'starts_at' => null,
            'ends_at' => null,
        ])
        ->assertSessionHasNoErrors();

    $this->assertDatabaseHas('promotions', [
        'slug' => 'promotion-administrateur',
        'created_by_id' => $admin->id,
        'responsible_user_id' => $commercial->id,
    ]);
});

test('a regular client cannot access promotion management', function () {
    $client = promotionUserWithRole('client');

    $this->actingAs($client)
        ->get(route('promotions.index', [], false))
        ->assertForbidden();

    $this->actingAs($client)
        ->post(route('promotions.store', [], false), [
            'title' => 'Forbidden',
            'responsible_user_id' => $client->id,
            'visibility' => 'targeted',
        ])
        ->assertForbidden();
});

test('a promotion end date must be later than its start date', function () {
    $commercial = promotionUserWithRole('commercial');

    $this->actingAs($commercial)
        ->post(route('promotions.store', [], false), [
            'title' => 'Invalid dates',
            'slug' => '',
            'description' => null,
            'responsible_user_id' => $commercial->id,
            'visibility' => 'targeted',
            'starts_at' => '2026-09-30 18:00:00',
            'ends_at' => '2026-09-01 08:00:00',
        ])
        ->assertSessionHasErrors('ends_at');

    expect(Promotion::query()->count())->toBe(0);
});

test('a manager cannot edit another managers promotion', function () {
    $owner = promotionUserWithRole('commercial');
    $outsider = promotionUserWithRole('commercial');
    $promotion = makePromotion($owner);

    $this->actingAs($outsider)
        ->get(route('promotions.edit.general', $promotion, false))
        ->assertForbidden();

    $this->actingAs($outsider)
        ->put(route('promotions.update', $promotion, false), [
            'title' => 'Unauthorized update',
            'slug' => $promotion->slug,
            'description' => null,
            'responsible_user_id' => $outsider->id,
            'visibility' => 'targeted',
            'starts_at' => null,
            'ends_at' => null,
        ])
        ->assertForbidden();
});
