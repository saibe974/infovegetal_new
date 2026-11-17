<?php

use App\Models\User;
use App\Models\UserMeta;
use Inertia\Testing\AssertableInertia as Assert;

it('sends the client selling price profiles to the checkout', function () {
    $user = User::factory()->withoutTwoFactor()->create();
    $settings = [
        'profiles' => [[
            'id' => 'retail',
            'name' => 'Détail',
            'conditions' => ['base' => 'departure', 'operator' => 'multiply', 'value' => 1.5, 'unit' => 'amount', 'rounding' => 'tenth', 'direction' => 'up'],
        ]],
        'default_profile_id' => 'retail',
    ];
    $user->usersMeta()->create([
        'key' => UserMeta::SELLING_PRICE_KEY,
        'title' => 'Prix de vente',
        'value' => json_encode($settings),
        'type' => 'json',
        'sort_order' => 0,
    ]);

    $this->actingAs($user)
        ->get(route('cart.checkout', absolute: false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('products/cart')
            ->where('cart_selling_price.default_profile_id', 'retail')
            ->where('cart_selling_price.profiles.0.conditions.value', 1.5));
});

it('sends no selling price when the client has none', function () {
    $this->actingAs(User::factory()->withoutTwoFactor()->create())
        ->get(route('cart.checkout', absolute: false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('cart_selling_price', null));
});
