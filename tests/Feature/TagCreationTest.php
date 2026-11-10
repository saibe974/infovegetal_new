<?php

use App\Models\Tag;
use App\Models\User;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $admin = User::factory()->withoutTwoFactor()->create();
    $admin->assignRole(Role::findOrCreate('admin', 'web'));
    $this->actingAs($admin);
});

it('creates a tag with a normalized name and generated slug', function () {
    $this->post(route('tags-products.store'), ['name' => '  Feuillage persistant  '])
        ->assertSessionHasNoErrors()->assertRedirect(route('tags-products.index'));
    $this->assertDatabaseHas('tags', ['name' => 'Feuillage persistant', 'slug' => 'feuillage-persistant']);
});

it('rejects empty names and duplicate slugs', function () {
    Tag::create(['name' => 'Pyramide', 'slug' => 'pyramide']);
    $this->post(route('tags-products.store'), ['name' => ' PYRAMIDE '])->assertSessionHasErrors('slug');
    $this->post(route('tags-products.store'), ['name' => '   '])->assertSessionHasErrors('name');
    $this->post(route('tags-products.store'), ['name' => '---'])->assertSessionHasErrors('slug');
    expect(Tag::count())->toBe(1);
});

it('does not allow ordinary users to create tags', function () {
    $this->actingAs(User::factory()->withoutTwoFactor()->create())
        ->post(route('tags-products.store'), ['name' => 'Pyramide'])->assertForbidden();
    $this->assertDatabaseMissing('tags', ['slug' => 'pyramide']);
});
