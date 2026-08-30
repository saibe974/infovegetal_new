<?php

use App\Models\Promotion;
use App\Models\PromotionCoupon;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

function couponManager(): User
{
    $role = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
    $user = User::factory()->withoutTwoFactor()->create();
    $user->assignRole($role);

    return $user;
}

function couponPromotion(User $owner, array $attributes = []): Promotion
{
    return Promotion::create(array_merge([
        'title' => 'Promotion coupons',
        'slug' => 'promotion-coupons-'.fake()->unique()->numberBetween(1, 999999),
        'status' => 'draft',
        'visibility' => 'targeted',
        'created_by_id' => $owner->id,
        'responsible_user_id' => $owner->id,
        'starts_at' => '2026-09-01 08:00:00',
        'ends_at' => '2026-09-30 18:00:00',
    ], $attributes));
}

function validCouponPayload(array $attributes = []): array
{
    return array_merge([
        'code' => ' ete-2026 ',
        'discount_type' => 'percent',
        'discount_value' => 10,
        'scope' => 'promotion_products',
        'funded_by' => 'seller',
        'minimum_order_ht' => 50,
        'maximum_discount_ht' => 25,
        'usage_limit' => 100,
        'usage_limit_per_customer' => 1,
        'starts_at' => null,
        'ends_at' => null,
        'stackable_with_promo_price' => true,
        'active' => true,
    ], $attributes);
}

test('a manager can create a normalized coupon inheriting promotion dates', function (): void {
    $manager = couponManager();
    $promotion = couponPromotion($manager);

    $this->actingAs($manager)
        ->post(route('promotions.coupons.store', $promotion, false), validCouponPayload())
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $coupon = PromotionCoupon::query()->sole();

    expect($coupon->code)->toBe('ETE-2026')
        ->and($coupon->effective_starts_at?->equalTo($promotion->starts_at))->toBeTrue()
        ->and($coupon->effective_ends_at?->equalTo($promotion->ends_at))->toBeTrue();

    $this->actingAs($manager)
        ->get(route('promotions.edit.coupons', $promotion, false))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('promotions/coupons')
            ->has('coupons', 1)
            ->where('coupons.0.code', 'ETE-2026'));
});

test('coupon codes are globally unique regardless of input casing', function (): void {
    $manager = couponManager();
    $promotion = couponPromotion($manager);

    $this->actingAs($manager)->post(route('promotions.coupons.store', $promotion, false), validCouponPayload());
    $this->actingAs($manager)
        ->post(route('promotions.coupons.store', $promotion, false), validCouponPayload(['code' => 'ete-2026']))
        ->assertSessionHasErrors('code');
});

test('a percent coupon cannot exceed one hundred percent', function (): void {
    $manager = couponManager();
    $promotion = couponPromotion($manager);

    $this->actingAs($manager)
        ->post(route('promotions.coupons.store', $promotion, false), validCouponPayload(['discount_value' => 101]))
        ->assertSessionHasErrors('discount_value');
});

test('effective coupon dates must form a valid range', function (): void {
    $manager = couponManager();
    $promotion = couponPromotion($manager);

    $this->actingAs($manager)
        ->post(route('promotions.coupons.store', $promotion, false), validCouponPayload([
            'starts_at' => null,
            'ends_at' => '2026-08-31 10:00:00',
        ]))
        ->assertSessionHasErrors('ends_at');
});

test('simulation caps the discount and reports insufficient funder margin', function (): void {
    $manager = couponManager();
    $promotion = couponPromotion($manager);
    $coupon = $promotion->coupons()->create(validCouponPayload([
        'code' => 'SIMULATION',
        'discount_value' => 20,
        'maximum_discount_ht' => 15,
    ]));

    $this->actingAs($manager)
        ->postJson(route('promotions.coupons.simulate', [$promotion, $coupon], false), [
            'eligible_ht' => 100,
            'funder_margin_ht' => 12,
        ])
        ->assertOk()
        ->assertJson([
            'eligible_ht' => 100,
            'discount_ht' => 15,
            'final_ht' => 85,
            'funder_margin_after_ht' => -3,
            'margin_sufficient' => false,
            'minimum_reached' => true,
        ]);
});

test('simulation applies no discount below the minimum order amount', function (): void {
    $manager = couponManager();
    $promotion = couponPromotion($manager);
    $coupon = $promotion->coupons()->create(validCouponPayload(['code' => 'MINIMUM']));

    $this->actingAs($manager)
        ->postJson(route('promotions.coupons.simulate', [$promotion, $coupon], false), [
            'eligible_ht' => 49.99,
            'funder_margin_ht' => 0,
        ])
        ->assertOk()
        ->assertJson([
            'discount_ht' => 0,
            'final_ht' => 49.99,
            'margin_sufficient' => true,
            'minimum_reached' => false,
        ]);
});

test('a coupon cannot be changed through another promotion', function (): void {
    $manager = couponManager();
    $promotion = couponPromotion($manager);
    $otherPromotion = couponPromotion($manager);
    $coupon = $promotion->coupons()->create(validCouponPayload(['code' => 'ISOLATED']));

    $this->actingAs($manager)
        ->put(route('promotions.coupons.update', [$otherPromotion, $coupon], false), validCouponPayload(['code' => 'HACKED']))
        ->assertSessionHasErrors('coupon');

    expect($coupon->fresh()->code)->toBe('ISOLATED');
});
