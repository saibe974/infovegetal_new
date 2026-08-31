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
    $commercial = audienceUser('commercial', ['id' => 2]);
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
            ->where('candidates.meta.total', 1)
            ->where('candidates.links.prev', null)
            ->where('candidates.links.next', null)
            ->where('candidates.data.0.id', $client->id)
            ->where('counts.eligible', 1)
            ->where('counts.eligible_mailing', 1));
});

test('a manager can save an explicit audience inside its branch', function (): void {
    $commercial = audienceUser('commercial', ['id' => 2]);
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
    $commercial = audienceUser('commercial', ['id' => 2]);
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

test('saving an empty selection clears the audience without deleting client accounts', function (): void {
    $admin = audienceUser('admin');
    $first = audienceUser('client');
    $second = audienceUser('client');
    $promotion = audiencePromotion($admin);
    $promotion->audienceUsers()->sync([$first->id, $second->id]);

    $this->actingAs($admin)->put(route('promotions.audience.update', $promotion, false), [
        'audience_mode' => 'selected',
        'user_ids' => [],
    ])->assertSessionHasNoErrors()->assertRedirect();

    expect($promotion->audienceUsers()->count())->toBe(0)
        ->and(User::whereKey([$first->id, $second->id])->count())->toBe(2);
});

test('all accessible mode materializes the current branch audience', function (): void {
    $commercial = audienceUser('commercial', ['id' => 2]);
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

test('an admin responsible can target active users of every role and branch', function (): void {
    $admin = audienceUser('admin', ['id' => 2]);
    $first = audienceUser('client');
    $second = audienceUser('commercial');
    $admin->saveAsRoot();
    $first->saveAsRoot();
    $second->saveAsRoot();
    $promotion = audiencePromotion($admin);

    $this->actingAs($admin)
        ->get(route('promotions.edit.audience', $promotion, false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('candidates.data', 3)
            ->where('counts.eligible', 3));
});

test('audience propositions only include eligible clients and respect the mailing filter', function (): void {
    $commercial = audienceUser('commercial', ['id' => 2]);
    $commercial->saveAsRoot();
    $client = audienceUser('client', ['name' => 'Jardin accessible', 'mailing' => true]);
    $optout = audienceUser('client', ['name' => 'Jardin sans mailing', 'mailing' => false]);
    $inactive = audienceUser('client', ['name' => 'Jardin inactif', 'active' => false]);
    $notClient = audienceUser('commercial', ['name' => 'Jardin commercial']);
    foreach ([$client, $optout, $inactive, $notClient] as $descendant) {
        $descendant->appendToNode($commercial)->save();
    }
    audienceUser('client', ['name' => 'Jardin extérieur'])->saveAsRoot();
    $promotion = audiencePromotion($commercial);
    $url = route('promotions.audience.propositions', $promotion, false);

    $this->actingAs($commercial)->getJson($url.'?q=Jardin&mailing=yes')->assertOk()
        ->assertJsonCount(1, 'propositions')->assertJsonPath('propositions.0.value', $client->email)
        ->assertJsonPath('propositions.0.label', $client->name)->assertJsonMissingPath('propositions.0.password');
    $this->getJson($url.'?q=Jardin&mailing=no')->assertOk()
        ->assertJsonCount(1, 'propositions')->assertJsonPath('propositions.0.value', $optout->email);
    $this->getJson($url.'?q=Jardin&mailing=all')->assertOk()->assertJsonCount(2, 'propositions');
    expect($promotion->audienceUsers()->count())->toBe(0);
});

test('audience propositions search names emails references and towns', function (string $field, string $value, string $search): void {
    $admin = audienceUser('admin');
    $client = audienceUser('client', [$field => $value]);
    $promotion = audiencePromotion($admin);
    $this->actingAs($admin)->getJson(route('promotions.audience.propositions', $promotion, false).'?'.http_build_query(['q' => $search]))
        ->assertOk()->assertJsonCount(1, 'propositions')->assertJsonPath('propositions.0.value', $client->email);
    $this->get(route('promotions.edit.audience', $promotion, false).'?'.http_build_query(['q' => $client->email]))
        ->assertOk()->assertInertia(fn (Assert $page) => $page->has('candidates.data', 1)->where('candidates.data.0.id', $client->id));
})->with([
    ['name', 'Pépinière des îles', 'Pépinière'],
    ['email', 'jardin@example.test', 'jardin@'],
    ['ref', 'CLI-JARDIN-42', 'JARDIN'],
    ['address_town', 'Saint-Pierre', 'Saint-Pierre'],
]);

test('audience propositions are bounded validated and unavailable without promotion permissions', function (): void {
    $admin = audienceUser('admin');
    $promotion = audiencePromotion($admin);
    $url = route('promotions.audience.propositions', $promotion, false);
    $this->getJson($url.'?q=Client')->assertUnauthorized();
    $other = audienceUser('commercial');
    $this->actingAs($other)->getJson($url.'?q=Client')->assertForbidden();
    $this->actingAs($admin)->getJson($url.'?q=a')->assertOk()->assertExactJson(['propositions' => []]);
    $this->getJson($url.'?'.http_build_query(['q' => '   ']))->assertOk()->assertExactJson(['propositions' => []]);
    $this->getJson($url.'?mailing=invalid')->assertUnprocessable()->assertJsonValidationErrors('mailing');
    $this->getJson($url.'?q='.str_repeat('a', 256))->assertUnprocessable()->assertJsonValidationErrors('q');
    for ($i = 0; $i < 12; $i++) {
        audienceUser('client', ['name' => 'Client suggestion '.$i]);
    }
    $response = $this->getJson($url.'?q=Client')->assertOk()->assertJsonCount(10, 'propositions');
    expect($response->headers->get('Cache-Control'))->toContain('private', 'no-store');
});

test('privileged responsible expands catalog suggestions and saving even for a branch limited editor', function (int $id, string $role): void {
    $responsible = audienceUser($role, ['id' => $id]);
    $editor = audienceUser('commercial');
    $outsider = audienceUser('seller', ['name' => 'Partenaire extérieur', 'mailing' => true]);
    $inactive = audienceUser('client', ['name' => 'Partenaire inactif', 'active' => false]);
    foreach ([$responsible, $editor, $outsider, $inactive] as $user) {
        $user->saveAsRoot();
    }
    $promotion = audiencePromotion($responsible);
    $promotion->update(['created_by_id' => $editor->id]);

    $this->actingAs($editor)->get(route('promotions.edit.audience', $promotion, false))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('candidates.data', 3)->where('counts.eligible', 3));
    $this->getJson(route('promotions.audience.propositions', $promotion, false).'?q=Partenaire&mailing=yes')
        ->assertOk()->assertJsonCount(1, 'propositions')->assertJsonPath('propositions.0.value', $outsider->email);
    $this->put(route('promotions.audience.update', $promotion, false), [
        'audience_mode' => 'selected', 'user_ids' => [$outsider->id],
    ])->assertSessionHasNoErrors();
    expect($promotion->audienceUsers()->pluck('users.id')->all())->toBe([$outsider->id]);

    $this->put(route('promotions.audience.update', $promotion, false), [
        'audience_mode' => 'all_accessible', 'user_ids' => [],
    ])->assertSessionHasNoErrors();
    expect($promotion->audienceUsers()->count())->toBe(3)
        ->and($promotion->audienceUsers()->whereKey($inactive->id)->exists())->toBeFalse();

    $this->put(route('promotions.audience.update', $promotion, false), [
        'audience_mode' => 'selected', 'user_ids' => [$inactive->id],
    ])->assertForbidden();
    // Removing the privileged responsible must remove the exception too.
    $promotion->update(['responsible_user_id' => $editor->id]);
    $this->getJson(route('promotions.audience.propositions', $promotion, false).'?q=Partenaire')
        ->assertOk()->assertJsonCount(0, 'propositions');
    $this->put(route('promotions.audience.update', $promotion, false), [
        'audience_mode' => 'selected', 'user_ids' => [$outsider->id],
    ])->assertForbidden();
})->with([[1, 'commercial'], [2, 'admin']]);
