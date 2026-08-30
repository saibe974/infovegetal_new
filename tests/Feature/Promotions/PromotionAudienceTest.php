<?php

use App\Models\Promotion;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

function audienceUser(string $roleName, array $attributes = []): User
{
    $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
    $user = User::factory()->withoutTwoFactor()->create($attributes);
    $user->assignRole($role);

    return $user;
}

function audiencePromotion(User $owner): Promotion
{
    return Promotion::create([
        'title' => 'Promotion audience',
        'slug' => 'promotion-audience-'.fake()->unique()->numerify('######'),
        'status' => 'draft',
        'visibility' => 'targeted',
        'created_by_id' => $owner->id,
        'responsible_user_id' => $owner->id,
    ]);
}

test('a commercial sees only active client descendants in the audience catalog', function (): void {
    $commercial = audienceUser('commercial');
    $client = audienceUser('client', ['name' => 'Client accessible', 'mailing' => true]);
    $inactiveClient = audienceUser('client', ['name' => 'Client inactif', 'active' => false]);
    $descendantCommercial = audienceUser('commercial', ['name' => 'Sous-commercial']);
    $outsider = audienceUser('client', ['name' => 'Client extérieur']);
    $commercial->saveAsRoot();
    $client->appendToNode($commercial)->save();
    $inactiveClient->appendToNode($commercial)->save();
    $descendantCommercial->appendToNode($commercial)->save();
    $outsider->saveAsRoot();
    $promotion = audiencePromotion($commercial);

    $this->actingAs($commercial)
        ->get(route('promotions.edit.audience', $promotion, false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('promotions/audience')
            ->has('candidates.data', 1)
            ->where('candidates.data.0.id', $client->id)
            ->where('counts.eligible', 1)
            ->where('counts.eligible_mailing', 1));
});

test('a manager can save an explicit audience inside its branch', function (): void {
    $commercial = audienceUser('commercial');
    $first = audienceUser('client', ['mailing' => true]);
    $second = audienceUser('client', ['mailing' => false]);
    $commercial->saveAsRoot();
    $first->appendToNode($commercial)->save();
    $second->appendToNode($commercial)->save();
    $promotion = audiencePromotion($commercial);

    $this->actingAs($commercial)
        ->put(route('promotions.audience.update', $promotion, false), [
            'audience_mode' => 'selected',
            'user_ids' => [$second->id, $first->id],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    expect($promotion->fresh()->audience_mode->value)->toBe('selected')
        ->and($promotion->audienceUsers()->pluck('users.id')->sort()->values()->all())
        ->toBe(collect([$first->id, $second->id])->sort()->values()->all())
        ->and($promotion->fresh()->audience_updated_at)->not->toBeNull();
});

test('a manager cannot add a client outside its branch', function (): void {
    $commercial = audienceUser('commercial');
    $outsider = audienceUser('client');
    $commercial->saveAsRoot();
    $outsider->saveAsRoot();
    $promotion = audiencePromotion($commercial);

    $this->actingAs($commercial)
        ->put(route('promotions.audience.update', $promotion, false), [
            'audience_mode' => 'selected',
            'user_ids' => [$outsider->id],
        ])
        ->assertForbidden();

    expect($promotion->audienceUsers()->count())->toBe(0);
});

test('all accessible mode materializes the current branch audience', function (): void {
    $commercial = audienceUser('commercial');
    $first = audienceUser('client');
    $second = audienceUser('client');
    $outsider = audienceUser('client');
    $commercial->saveAsRoot();
    $first->appendToNode($commercial)->save();
    $second->appendToNode($commercial)->save();
    $outsider->saveAsRoot();
    $promotion = audiencePromotion($commercial);

    $this->actingAs($commercial)
        ->put(route('promotions.audience.update', $promotion, false), [
            'audience_mode' => 'all_accessible',
            'user_ids' => [],
        ])
        ->assertSessionHasNoErrors();

    expect($promotion->fresh()->audience_mode->value)->toBe('all_accessible')
        ->and($promotion->audienceUsers()->pluck('users.id')->sort()->values()->all())
        ->toBe(collect([$first->id, $second->id])->sort()->values()->all());
});

test('an admin can target active clients from every branch', function (): void {
    $admin = audienceUser('admin');
    $first = audienceUser('client');
    $second = audienceUser('client');
    $admin->saveAsRoot();
    $first->saveAsRoot();
    $second->saveAsRoot();
    $promotion = audiencePromotion($admin);

    $this->actingAs($admin)
        ->get(route('promotions.edit.audience', $promotion, false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('candidates.data', 2)
            ->where('counts.eligible', 2));
});
