<?php

namespace App\Services;

use App\Domain\Promotions\Enums\PromotionMailingRecipientStatus as RecipientStatus;
use App\Domain\Promotions\Enums\PromotionMailingStatus as MailingStatus;
use App\Mail\PromotionMailMessage;
use App\Models\PromotionMailing;
use App\Models\PromotionMailingRecipient;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;
use Throwable;

final class PromotionMailingService
{
    public function __construct(private readonly PromotionAudienceService $audience) {}

    public function prepare(PromotionMailing $mailing, User $actor, ?string $scheduledAt): void
    {
        DB::transaction(function () use ($mailing, $actor, $scheduledAt): void {
            $mailing = PromotionMailing::query()->lockForUpdate()->findOrFail($mailing->id);
            $this->assertDraft($mailing);
            $users = $this->audience->eligibleQuery($actor)
                ->whereIn('users.id', $mailing->promotion->audienceUsers()->select('users.id'))
                ->where('mailing', true)
                ->orderBy('users.id')->get(['users.id', 'users.name', 'users.email']);
            $users = $users->filter(fn (User $user) => filter_var($user->email, FILTER_VALIDATE_EMAIL))
                ->unique(fn (User $user) => mb_strtolower(trim($user->email)));

            if ($users->isEmpty()) {
                throw ValidationException::withMessages(['mailing' => 'Aucun destinataire éligible. Enregistrez une audience avec des clients ayant accepté les mailings.']);
            }

            foreach ($users->chunk(250) as $chunk) {
                $mailing->recipients()->insert($chunk->map(fn (User $user) => [
                    'promotion_mailing_id' => $mailing->id,
                    'user_id' => $user->id,
                    'email_snapshot' => $user->email,
                    'name_snapshot' => $user->name,
                    'status' => RecipientStatus::Pending->value,
                    'created_at' => now(), 'updated_at' => now(),
                ])->all());
            }

            $mailing->update([
                'status' => MailingStatus::Ready, 'scheduled_at' => $scheduledAt,
                'snapshot_at' => now(), 'recipient_count' => $users->count(),
            ]);
        });
    }

    // One recipient per HTTP request limits work on shared hosting.
    public function sendNext(PromotionMailing $mailing, User $actor): array
    {
        $recipient = DB::transaction(function () use ($mailing): ?PromotionMailingRecipient {
            $locked = PromotionMailing::query()->lockForUpdate()->findOrFail($mailing->id);
            abort_unless(in_array($locked->status, [MailingStatus::Ready, MailingStatus::Sending, MailingStatus::Sent], true), 409, 'Ce mailing ne peut pas être envoyé.');
            if ($locked->scheduled_at?->isFuture()) {
                throw ValidationException::withMessages(['mailing' => 'La date de disponibilité de cet envoi n’est pas encore atteinte.']);
            }
            $next = $locked->recipients()->where('status', RecipientStatus::Pending)->orderBy('id')->first();
            if (! $next) {
                return null;
            }
            // Persist the claim before SMTP: uncertain deliveries are never automatically retried.
            $next->update(['status' => RecipientStatus::Processing]);
            $locked->update(['status' => MailingStatus::Sending, 'started_at' => $locked->started_at ?? now()]);

            return $next;
        });

        if ($recipient) {
            $user = $recipient->user;
            $reason = match (true) {
                ! $user => 'Compte supprimé',
                ! $user->active => 'Compte inactif',
                ! $user->mailing => 'Désinscrit des mailings',
                $user->email !== $recipient->email_snapshot => 'Adresse email modifiée depuis la préparation',
                ! $this->audience->eligibleQuery($actor)->whereKey($user->id)->exists() => 'Client hors du périmètre actuel',
                default => null,
            };

            if ($reason) {
                $recipient->update(['status' => RecipientStatus::Skipped, 'skip_reason' => $reason]);
            } else {
                try {
                    Mail::to($recipient->email_snapshot)->send(new PromotionMailMessage(
                        $mailing->fresh(), URL::signedRoute('promotions.unsubscribe', ['user' => $user->id]),
                    ));
                    $recipient->update(['status' => RecipientStatus::Sent, 'sent_at' => now()]);
                } catch (Throwable $exception) {
                    report($exception);
                    $recipient->update(['status' => RecipientStatus::Failed, 'error' => 'Envoi non confirmé par le transport. Vérifiez les journaux avant tout nouvel envoi.']);
                }
            }
        }

        return $this->progress($mailing);
    }

    public function progress(PromotionMailing $mailing): array
    {
        return DB::transaction(function () use ($mailing): array {
            $locked = PromotionMailing::query()->lockForUpdate()->findOrFail($mailing->id);
            $counts = $locked->recipients()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
            $pending = (int) ($counts['pending'] ?? 0);
            $processing = (int) ($counts['processing'] ?? 0);
            $locked->fill([
                'sent_count' => (int) ($counts['sent'] ?? 0),
                'skipped_count' => (int) ($counts['skipped'] ?? 0),
                'failed_count' => (int) ($counts['failed'] ?? 0),
            ]);
            if ($pending === 0 && $processing === 0 && in_array($locked->status, [MailingStatus::Ready, MailingStatus::Sending], true)) {
                $locked->fill(['status' => MailingStatus::Sent, 'completed_at' => now()]);
            }
            $locked->save();

            return [...$locked->toArray(), 'pending_count' => $pending, 'processing_count' => $processing];
        });
    }

    public function assertDraft(PromotionMailing $mailing): void
    {
        abort_unless($mailing->status === MailingStatus::Draft, 409, 'Seul un brouillon peut être modifié ou préparé.');
    }
}
