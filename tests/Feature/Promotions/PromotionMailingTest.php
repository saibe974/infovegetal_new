<?php

use App\Mail\PromotionMailMessage;
use App\Models\Promotion;
use App\Models\PromotionMailing;
use App\Models\User;
use App\Services\PromotionMailingService;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

function mailingUser(string $role = 'client', array $attributes = []): User
{
    $user = User::factory()->withoutTwoFactor()->create(['active' => true, 'mailing' => true, ...$attributes]);
    $user->assignRole(Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']));

    return $user;
}

function mailingPromotion(User $owner): Promotion
{
    return Promotion::create([
        'title' => 'Promotion mailing', 'slug' => fake()->unique()->slug(), 'status' => 'draft', 'visibility' => 'targeted',
        'created_by_id' => $owner->id, 'responsible_user_id' => $owner->id,
    ]);
}

function mailingDraft(Promotion $promotion): PromotionMailing
{
    return $promotion->mailings()->create(['name' => 'Annonce', 'subject' => 'Notre sélection', 'body' => 'Découvrez les produits.']);
}

beforeEach(function (): void {
    Mail::fake();
    Queue::fake();
});

test('managers create edit and view mailing drafts without sending or queueing', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $this->actingAs($admin)->post(route('promotions.mailings.store', $promotion, false), [
        'name' => 'Annonce', 'subject' => 'Sélection', 'body' => 'Bonjour', 'cta_label' => 'Voir', 'cta_url' => 'https://example.com/offre',
    ])->assertSessionHasNoErrors()->assertRedirect();
    $mailing = $promotion->mailings()->firstOrFail();
    $this->put(route('promotions.mailings.update', [$promotion, $mailing], false), [
        'name' => 'Annonce modifiée', 'subject' => 'Nouvelle sélection', 'body' => 'Bonjour',
    ])->assertSessionHasNoErrors();
    $this->get(route('promotions.edit.mailing', $promotion, false))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('promotions/mailing')->has('mailings', 1)->where('mailings.0.name', 'Annonce modifiée'));
    Mail::assertNothingSent();
    Queue::assertNothingPushed();
});

test('mailing content rejects unsafe links and invalid subjects', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $this->actingAs($admin)->postJson(route('promotions.mailings.store', $promotion, false), [
        'name' => 'Annonce', 'subject' => "Objet\r\nBcc: other@example.com", 'body' => 'Bonjour', 'cta_url' => 'javascript:alert(1)',
    ])->assertUnprocessable()->assertJsonValidationErrors(['subject', 'cta_url', 'cta_label']);
});

test('preparation freezes only eligible opted in recipients and cannot be repeated or edited', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $client = mailingUser();
    $optout = mailingUser(attributes: ['mailing' => false]);
    $inactive = mailingUser(attributes: ['active' => false]);
    $promotion->audienceUsers()->sync([$client->id, $optout->id, $inactive->id]);
    $mailing = mailingDraft($promotion);
    $this->actingAs($admin)->post(route('promotions.mailings.prepare', [$promotion, $mailing], false))->assertSessionHasNoErrors();
    expect($mailing->fresh()->recipient_count)->toBe(1)
        ->and($mailing->recipients()->first()->email_snapshot)->toBe($client->email);
    $promotion->audienceUsers()->detach();
    expect($mailing->recipients()->count())->toBe(1);
    $this->postJson(route('promotions.mailings.prepare', [$promotion, $mailing], false))->assertConflict();
    $this->putJson(route('promotions.mailings.update', [$promotion, $mailing], false), ['name' => 'x', 'subject' => 'x', 'body' => 'x'])->assertConflict();
    $this->deleteJson(route('promotions.mailings.destroy', [$promotion, $mailing], false))->assertConflict();
    Mail::assertNothingSent();
});

test('an empty eligible audience cannot be prepared', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $mailing = mailingDraft($promotion);
    $this->actingAs($admin)->postJson(route('promotions.mailings.prepare', [$promotion, $mailing], false))
        ->assertUnprocessable()->assertJsonValidationErrors('mailing');
    expect($mailing->fresh()->status->value)->toBe('draft');
});

test('each HTTP request sends one recipient synchronously and resumes without repeating completed recipients', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $promotion->audienceUsers()->sync([mailingUser()->id, mailingUser()->id]);
    $mailing = mailingDraft($promotion);
    app(PromotionMailingService::class)->prepare($mailing, $admin, null);
    $url = route('promotions.mailings.send-batch', [$promotion, $mailing], false);
    $this->actingAs($admin)->postJson($url)->assertOk()->assertJsonPath('sent_count', 1)->assertJsonPath('pending_count', 1);
    $this->postJson($url)->assertOk()->assertJsonPath('sent_count', 2)->assertJsonPath('status', 'sent');
    $this->postJson($url)->assertOk()->assertJsonPath('sent_count', 2);
    Mail::assertSent(PromotionMailMessage::class, 2);
    Mail::assertNothingQueued();
    Queue::assertNothingPushed();
});

test('send time revalidates opt in activity email and deletion', function (string $change): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $client = mailingUser();
    $promotion->audienceUsers()->sync([$client->id]);
    $mailing = mailingDraft($promotion);
    app(PromotionMailingService::class)->prepare($mailing, $admin, null);
    match ($change) {
        'optout' => $client->update(['mailing' => false]),
        'inactive' => $client->update(['active' => false]),
        'email' => $client->update(['email' => 'changed@example.com']),
        'deleted' => $client->delete(),
    };
    $this->actingAs($admin)->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))
        ->assertOk()->assertJsonPath('sent_count', 0)->assertJsonPath('skipped_count', 1);
    Mail::assertNothingSent();
})->with(['optout', 'inactive', 'email', 'deleted']);

test('scheduled mailings cannot send early and require an explicit later request', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $promotion->audienceUsers()->sync([mailingUser()->id]);
    $mailing = mailingDraft($promotion);
    app(PromotionMailingService::class)->prepare($mailing, $admin, now()->addHour()->toIso8601String());
    $this->actingAs($admin)->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))->assertUnprocessable();
    $this->travel(61)->minutes();
    Mail::assertNothingSent();
    $this->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))->assertOk()->assertJsonPath('sent_count', 1);
});

test('interrupted claims are not retried but remaining recipients can be sent', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $promotion->audienceUsers()->sync([mailingUser()->id, mailingUser()->id]);
    $mailing = mailingDraft($promotion);
    app(PromotionMailingService::class)->prepare($mailing, $admin, null);
    $mailing->recipients()->first()->update(['status' => 'processing']);
    $this->actingAs($admin)->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))
        ->assertOk()->assertJsonPath('sent_count', 1)->assertJsonPath('processing_count', 1)->assertJsonPath('pending_count', 0);
    $this->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))->assertOk()->assertJsonPath('sent_count', 1);
    Mail::assertSent(PromotionMailMessage::class, 1);
});

test('a transport failure is persisted and never automatically retried', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $promotion->audienceUsers()->sync([mailingUser()->id]);
    $mailing = mailingDraft($promotion);
    app(PromotionMailingService::class)->prepare($mailing, $admin, null);
    Mail::shouldReceive('to')->once()->andReturnSelf();
    Mail::shouldReceive('send')->once()->andThrow(new RuntimeException('Simulated SMTP interruption'));
    $this->actingAs($admin)->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))
        ->assertOk()->assertJsonPath('failed_count', 1)->assertJsonPath('sent_count', 0);
    $this->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))->assertOk();
});

test('an overlapping request cannot claim the recipient already being sent', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $promotion->audienceUsers()->sync([mailingUser()->id]);
    $mailing = mailingDraft($promotion);
    $service = app(PromotionMailingService::class);
    $service->prepare($mailing, $admin, null);
    Mail::shouldReceive('to')->once()->andReturnSelf();
    Mail::shouldReceive('send')->once()->andReturnUsing(function () use ($service, $mailing, $admin): void {
        $overlapping = $service->sendNext($mailing, $admin);
        expect($overlapping['processing_count'])->toBe(1)
            ->and($overlapping['pending_count'])->toBe(0)
            ->and($overlapping['sent_count'])->toBe(0);
    });
    $result = $service->sendNext($mailing, $admin);
    expect($result['sent_count'])->toBe(1)->and($result['status'])->toBe('sent');
});

test('reopening the page recovers counters even when the previous request stopped before aggregation', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $promotion->audienceUsers()->sync([mailingUser()->id]);
    $mailing = mailingDraft($promotion);
    app(PromotionMailingService::class)->prepare($mailing, $admin, null);
    $mailing->recipients()->first()->update(['status' => 'sent', 'sent_at' => now()]);
    expect($mailing->fresh()->sent_count)->toBe(0);
    $this->actingAs($admin)->get(route('promotions.edit.mailing', $promotion, false))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('mailings.0.sent_count', 1)->where('mailings.0.pending_count', 0));
});

test('cancellation keeps sent history and prevents further sends', function (): void {
    $admin = mailingUser('admin');
    $promotion = mailingPromotion($admin);
    $promotion->audienceUsers()->sync([mailingUser()->id, mailingUser()->id]);
    $mailing = mailingDraft($promotion);
    app(PromotionMailingService::class)->prepare($mailing, $admin, null);
    $this->actingAs($admin)->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))->assertOk();
    $this->post(route('promotions.mailings.cancel', [$promotion, $mailing], false))->assertRedirect();
    $this->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))->assertConflict();
    expect($mailing->fresh()->sent_count)->toBe(1)->and($mailing->fresh()->skipped_count)->toBe(1);
    Mail::assertSent(PromotionMailMessage::class, 1);
});

test('mailing routes reject foreign promotions and cross promotion mailing identifiers', function (): void {
    $owner = mailingUser('commercial');
    $other = mailingUser('commercial');
    $promotion = mailingPromotion($owner);
    $foreign = mailingPromotion($other);
    $mailing = mailingDraft($foreign);
    $this->actingAs($owner)->get(route('promotions.edit.mailing', $foreign, false))->assertForbidden();
    $this->postJson(route('promotions.mailings.send-batch', [$foreign, $mailing], false))->assertForbidden();
    $this->postJson(route('promotions.mailings.prepare', [$promotion, $mailing], false))->assertNotFound();
    $this->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))->assertNotFound();
});

test('preparation and send recheck the commercial scope', function (): void {
    $owner = mailingUser('commercial', ['id' => 2]);
    $owner->saveAsRoot();
    $client = mailingUser();
    $client->appendToNode($owner)->save();
    $outsider = mailingUser();
    $outsider->saveAsRoot();
    $promotion = mailingPromotion($owner);
    $promotion->audienceUsers()->sync([$client->id, $outsider->id]);
    $mailing = mailingDraft($promotion);
    app(PromotionMailingService::class)->prepare($mailing, $owner->fresh(), null);
    expect($mailing->fresh()->recipient_count)->toBe(1);
    $client->saveAsRoot();
    $this->actingAs($owner->fresh())->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))->assertOk()->assertJsonPath('skipped_count', 1);
    Mail::assertNothingSent();
});

test('mailing honors the privileged responsible audience without relaxing opt in', function (int $id, string $role): void {
    $responsible = mailingUser($role, ['id' => $id]);
    $editor = mailingUser('commercial');
    $recipient = mailingUser('seller');
    $optout = mailingUser('seller', ['mailing' => false]);
    foreach ([$responsible, $editor, $recipient, $optout] as $user) {
        $user->saveAsRoot();
    }
    $promotion = mailingPromotion($responsible);
    $promotion->update(['created_by_id' => $editor->id]);
    $promotion->audienceUsers()->sync([$recipient->id, $optout->id]);
    $mailing = mailingDraft($promotion);
    $this->actingAs($editor)->post(route('promotions.mailings.prepare', [$promotion, $mailing], false))->assertSessionHasNoErrors();
    expect($mailing->fresh()->recipient_count)->toBe(1);
    $this->postJson(route('promotions.mailings.send-batch', [$promotion, $mailing], false))
        ->assertOk()->assertJsonPath('sent_count', 1);
    Mail::assertSent(PromotionMailMessage::class, fn (PromotionMailMessage $message) => $message->hasTo($recipient->email));
    Mail::assertSent(PromotionMailMessage::class, 1);
})->with([[1, 'commercial'], [2, 'admin']]);

test('unsubscribe requires a valid signed link and confirmation without authentication', function (): void {
    $client = mailingUser();
    $url = URL::signedRoute('promotions.unsubscribe', ['user' => $client->id]);
    $this->get($url)->assertOk()->assertSee('Confirmer ma désinscription');
    expect($client->fresh()->mailing)->toBeTrue();
    $this->post($url)->assertOk()->assertSee('Votre désinscription est enregistrée');
    expect($client->fresh()->mailing)->toBeFalse();
    $this->post($url)->assertOk();
    $this->post(route('promotions.unsubscribe.confirm', $client, false))->assertForbidden();
    $other = mailingUser();
    $this->post(str_replace('/'.$client->id.'?', '/'.$other->id.'?', $url))->assertForbidden();
    expect($other->fresh()->mailing)->toBeTrue();
});

test('email rendering escapes content and includes the signed unsubscribe link', function (): void {
    $admin = mailingUser('admin');
    $mailing = mailingDraft(mailingPromotion($admin));
    $mailing->update(['body' => '<script>alert(1)</script>', 'heading' => '<b>Title</b>']);
    $url = URL::signedRoute('promotions.unsubscribe', ['user' => $admin->id]);
    $html = (new PromotionMailMessage($mailing, $url))->render();
    expect($html)->toContain('&lt;script&gt;', '&lt;b&gt;Title&lt;/b&gt;', e($url))->not->toContain('<script>', '<b>Title</b>');
});
