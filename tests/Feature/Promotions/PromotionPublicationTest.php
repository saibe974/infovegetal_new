<?php

use App\Domain\Promotions\Enums\PromotionStatus;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

function publicationUser(string $role = 'admin', array $attributes = []): User
{
    $user = User::factory()->withoutTwoFactor()->create(['active' => true, ...$attributes]);
    $user->assignRole(Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']));

    return $user;
}

function publicationPromotion(User $owner, array $attributes = []): Promotion
{
    return Promotion::create([
        'title' => 'Offre de printemps', 'slug' => fake()->unique()->slug(),
        'status' => 'draft', 'visibility' => 'public', 'presentation_body' => 'Découvrez notre sélection.',
        'created_by_id' => $owner->id, 'responsible_user_id' => $owner->id, ...$attributes,
    ]);
}

function publicationProduct(array $attributes = []): Product
{
    return Product::create([
        'name' => 'Plante', 'sku' => fake()->unique()->numerify('SKU########'), 'ref' => fake()->unique()->numerify('REF########'),
        'ean13' => fake()->unique()->numerify('#############'), 'price' => 42, 'active' => true, ...$attributes,
    ]);
}

test('a manager saves public presentation without publishing internal notes or sending mail', function (): void {
    Mail::fake();
    Queue::fake();
    $owner = publicationUser();
    $promotion = publicationPromotion($owner, ['description' => 'Confidential internal notes']);
    $this->actingAs($owner)->put(route('promotions.presentation.update', $promotion, false), [
        'presentation_title' => 'Notre offre', 'presentation_body' => 'Texte client', 'terms' => 'Conditions client', 'show_coupons' => false,
        'status' => 'active',
    ])->assertSessionHasNoErrors();
    expect($promotion->fresh()->status)->toBe(PromotionStatus::Draft);
    $this->get(route('promotions.edit.presentation', $promotion, false))->assertOk()->assertInertia(fn (Assert $page) => $page->component('promotions/presentation'));
    $this->get(route('promotions.preview', $promotion, false))->assertOk()->assertHeader('X-Robots-Tag', 'noindex, nofollow')
        ->assertInertia(fn (Assert $page) => $page->component('promotions/show')->where('preview', true)
            ->where('offer.title', 'Notre offre')->where('offer.body', 'Texte client')->missing('offer.description')->missing('offer.created_by_id'));
    Mail::assertNothingSent();
    Queue::assertNothingPushed();
});

test('publishing opens a public page and suspension or draft closes it', function (): void {
    Mail::fake();
    Queue::fake();
    $owner = publicationUser();
    $promotion = publicationPromotion($owner);
    $url = route('offers.show', $promotion->slug, false);
    $this->get($url)->assertNotFound();
    $this->actingAs($owner)->post(route('promotions.publication.update', $promotion, false), ['action' => 'publish'])->assertSessionHasNoErrors();
    $this->get($url)->assertOk();
    expect($promotion->fresh()->published_at)->not->toBeNull();
    $this->post(route('promotions.publication.update', $promotion, false), ['action' => 'suspend'])->assertSessionHasNoErrors();
    $this->get($url)->assertNotFound();
    $this->post(route('promotions.publication.update', $promotion, false), ['action' => 'publish'])->assertSessionHasNoErrors();
    $this->post(route('promotions.publication.update', $promotion, false), ['action' => 'draft'])->assertSessionHasNoErrors();
    $this->get($url)->assertNotFound();
    Mail::assertNothingSent();
    Queue::assertNothingPushed();
});

test('scheduled promotions open and expire at request time without a job', function (): void {
    $owner = publicationUser();
    $promotion = publicationPromotion($owner, ['starts_at' => now()->addHour(), 'ends_at' => now()->addHours(2)]);
    $this->actingAs($owner)->post(route('promotions.publication.update', $promotion, false), ['action' => 'publish'])->assertSessionHasNoErrors();
    expect($promotion->fresh()->status)->toBe(PromotionStatus::Scheduled);
    $url = route('offers.show', $promotion->slug, false);
    $this->get($url)->assertNotFound();
    $this->travel(61)->minutes();
    $this->get($url)->assertOk();
    $this->get('/promotions?status=active')->assertOk()->assertInertia(fn (Assert $page) => $page->has('collection.data', 1)->where('collection.data.0.status', 'active'));
    $this->travel(60)->minutes();
    $this->get($url)->assertNotFound();
    $this->get('/promotions?status=ended')->assertOk()->assertInertia(fn (Assert $page) => $page->has('collection.data', 1)->where('collection.data.0.status', 'ended'));
    expect($promotion->fresh()->status)->toBe(PromotionStatus::Scheduled);
});

test('publication requires content and a valid audience and date range', function (array $attributes): void {
    $owner = publicationUser();
    $promotion = publicationPromotion($owner, $attributes);
    $this->actingAs($owner)->postJson(route('promotions.publication.update', $promotion, false), ['action' => 'publish'])
        ->assertUnprocessable()->assertJsonValidationErrors('publication');
    expect($promotion->fresh()->published_at)->toBeNull();
})->with([
    'empty content' => [['presentation_body' => null]],
    'empty targeted audience' => [['visibility' => 'targeted']],
    'expired' => [['ends_at' => '2000-01-01']],
    'invalid period' => [['starts_at' => '2099-02-01', 'ends_at' => '2099-01-01']],
    'cancelled' => [['status' => 'cancelled']],
]);

test('a simple selection can be published without coupons or mailing', function (): void {
    $owner = publicationUser();
    $promotion = publicationPromotion($owner, ['presentation_body' => null]);
    $promotion->products()->attach(publicationProduct()->id);
    $this->actingAs($owner)->post(route('promotions.publication.update', $promotion, false), ['action' => 'publish'])->assertSessionHasNoErrors();
    $this->get(route('offers.show', $promotion->slug, false))->assertOk()->assertInertia(fn (Assert $page) => $page->has('offer.products', 1)->has('offer.coupons', 0));
});

test('public listing excludes unlisted drafts and restricted offers for guests', function (): void {
    $owner = publicationUser();
    $public = publicationPromotion($owner, ['status' => 'active']);
    $unlisted = publicationPromotion($owner, ['status' => 'active', 'visibility' => 'unlisted']);
    publicationPromotion($owner, ['status' => 'active', 'visibility' => 'authenticated']);
    publicationPromotion($owner, ['status' => 'active', 'visibility' => 'targeted']);
    publicationPromotion($owner);
    $this->get('/offres')->assertOk()->assertInertia(fn (Assert $page) => $page->component('promotions/offers')->has('offers.data', 1)->where('offers.data.0.url', route('offers.show', $public->slug)));
    $this->get(route('offers.show', $unlisted->slug, false))->assertOk()->assertHeader('X-Robots-Tag', 'noindex, nofollow');
});

test('targeted pages require membership even for managers and ignore preview query parameters', function (): void {
    $owner = publicationUser();
    $client = publicationUser('client');
    $promotion = publicationPromotion($owner, ['status' => 'active', 'visibility' => 'targeted']);
    $promotion->audienceUsers()->attach($client->id);
    $url = route('offers.show', $promotion->slug, false);
    $this->get($url.'?preview=1')->assertNotFound();
    $this->actingAs($owner)->get($url)->assertNotFound();
    $this->actingAs($client)->get($url)->assertOk();
    $this->get('/offres')->assertOk()->assertInertia(fn (Assert $page) => $page->has('offers.data', 1));
    $client->update(['active' => false]);
    $this->get($url)->assertNotFound();
});

test('authenticated pages require an active signed in user', function (): void {
    $promotion = publicationPromotion(publicationUser(), ['status' => 'active', 'visibility' => 'authenticated']);
    $url = route('offers.show', $promotion->slug, false);
    $this->get($url)->assertNotFound();
    $client = publicationUser('client');
    $this->actingAs($client)->get($url)->assertOk()->assertHeader('X-Robots-Tag', 'noindex, nofollow');
    $client->update(['active' => false]);
    $this->get($url)->assertNotFound();
});

test('public pages expose only selected safe fields and authorized future previews', function (): void {
    $promotion = publicationPromotion(publicationUser(), ['status' => 'active', 'description' => 'INTERNAL_SECRET']);
    $available = publicationProduct();
    $upcoming = publicationProduct(['available_from' => now()->addWeek()]);
    $hiddenFuture = publicationProduct(['available_from' => now()->addWeek()]);
    $inactive = publicationProduct(['active' => false]);
    $expired = publicationProduct(['available_until' => now()->subDay()]);
    foreach ([
        $available->id => ['position' => 1, 'custom_title' => 'Titre public'],
        $upcoming->id => ['position' => 0, 'show_before_availability' => true, 'featured' => true],
        $hiddenFuture->id => ['position' => 2, 'show_before_availability' => false],
        $inactive->id => ['position' => 3, 'show_before_availability' => true],
        $expired->id => ['position' => 4],
    ] as $productId => $pivot) {
        $promotion->products()->attach($productId, $pivot);
    }
    $response = $this->get(route('offers.show', $promotion->slug, false))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('offer.products', 2)
            ->where('offer.products.0.id', $upcoming->id)->where('offer.products.0.orderable', false)->where('offer.products.0.url', null)
            ->where('offer.products.1.title', 'Titre public')->where('offer.products.1.orderable', true)
            ->missing('offer.products.0.price')->missing('offer.products.0.db_products_id')->missing('offer.description')->missing('offer.responsible_user_id'));
    expect($response->headers->get('Cache-Control'))->toContain('no-store', 'private');
    $this->get('/products/'.$upcoming->id)->assertNotFound();
    $this->get('/api/products/'.$upcoming->id)->assertNotFound();
});

test('coupons are private by default and optional public display excludes inactive or expired codes', function (): void {
    $promotion = publicationPromotion(publicationUser(), ['status' => 'active']);
    foreach (['VISIBLE', 'INACTIVE', 'EXPIRED'] as $code) {
        $promotion->coupons()->create([
            'code' => $code, 'discount_type' => 'percent', 'discount_value' => 10, 'scope' => 'cart', 'funded_by' => 'seller',
            'active' => $code !== 'INACTIVE', 'ends_at' => $code === 'EXPIRED' ? now()->subDay() : null,
        ]);
    }
    $url = route('offers.show', $promotion->slug, false);
    $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->has('offer.coupons', 0));
    $promotion->update(['show_coupons' => true]);
    $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->has('offer.coupons', 1)->where('offer.coupons.0.code', 'VISIBLE')->missing('offer.coupons.0.funded_by'));
});

test('unauthorized users cannot preview edit or publish another managers promotion', function (): void {
    $owner = publicationUser('commercial');
    $other = publicationUser('commercial');
    $promotion = publicationPromotion($owner);
    $this->actingAs($other)->get(route('promotions.preview', $promotion, false))->assertForbidden();
    $this->get(route('promotions.edit.publication', $promotion, false))->assertForbidden();
    $this->putJson(route('promotions.presentation.update', $promotion, false), ['show_coupons' => true])->assertForbidden();
    $this->postJson(route('promotions.publication.update', $promotion, false), ['action' => 'publish'])->assertForbidden();
});
