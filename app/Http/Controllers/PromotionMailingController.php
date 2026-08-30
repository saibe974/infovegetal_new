<?php

namespace App\Http\Controllers;

use App\Domain\Promotions\Enums\PromotionMailingStatus;
use App\Http\Requests\Promotions\SavePromotionMailingRequest;
use App\Models\Promotion;
use App\Models\PromotionMailing;
use App\Services\PromotionMailingService;
use App\Services\PromotionWorkspaceDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PromotionMailingController extends Controller
{
    public function __construct(
        private readonly PromotionMailingService $mailings,
        private readonly PromotionWorkspaceDataService $workspace,
    ) {}

    public function edit(Promotion $promotion): Response
    {
        $this->authorize('update', $promotion);
        $promotion->load(['creator:id,name', 'responsible:id,name']);

        return Inertia::render('promotions/mailing', [
            'promotion' => $this->workspace->for($promotion),
            'mailings' => $promotion->mailings()->withCount([
                'recipients as pending_count' => fn ($query) => $query->where('status', 'pending'),
                'recipients as processing_count' => fn ($query) => $query->where('status', 'processing'),
                'recipients as sent_count' => fn ($query) => $query->where('status', 'sent'),
                'recipients as skipped_count' => fn ($query) => $query->where('status', 'skipped'),
                'recipients as failed_count' => fn ($query) => $query->where('status', 'failed'),
            ])->get(),
            'mailTransport' => config('mail.default'),
        ]);
    }

    public function store(SavePromotionMailingRequest $request, Promotion $promotion): RedirectResponse
    {
        $promotion->mailings()->create([...$request->validated(), 'created_by_id' => $request->user()->authorizationActor()->id]);

        return back()->with('success', 'Brouillon de mailing créé.');
    }

    public function update(SavePromotionMailingRequest $request, Promotion $promotion, PromotionMailing $mailing): RedirectResponse
    {
        $this->assertMailing($promotion, $mailing);
        DB::transaction(function () use ($request, $mailing): void {
            $locked = PromotionMailing::query()->lockForUpdate()->findOrFail($mailing->id);
            $this->mailings->assertDraft($locked);
            $locked->update($request->validated());
        });

        return back()->with('success', 'Brouillon enregistré.');
    }

    public function destroy(Promotion $promotion, PromotionMailing $mailing): RedirectResponse
    {
        $this->assertMailing($promotion, $mailing);
        DB::transaction(function () use ($mailing): void {
            $locked = PromotionMailing::query()->lockForUpdate()->findOrFail($mailing->id);
            $this->mailings->assertDraft($locked);
            $locked->delete();
        });

        return back()->with('success', 'Brouillon supprimé.');
    }

    public function prepare(Request $request, Promotion $promotion, PromotionMailing $mailing): RedirectResponse
    {
        $this->assertMailing($promotion, $mailing);
        $data = $request->validate(['scheduled_at' => ['nullable', 'date', 'after_or_equal:now']]);
        $this->mailings->prepare($mailing, $request->user(), $data['scheduled_at'] ?? null);

        return back()->with('success', 'Destinataires figés. Le mailing attend un lancement manuel.');
    }

    public function sendBatch(Request $request, Promotion $promotion, PromotionMailing $mailing): JsonResponse
    {
        $this->assertMailing($promotion, $mailing);

        return response()->json($this->mailings->sendNext($mailing, $request->user()));
    }

    public function cancel(Promotion $promotion, PromotionMailing $mailing): RedirectResponse
    {
        $this->assertMailing($promotion, $mailing);
        DB::transaction(function () use ($mailing): void {
            $locked = PromotionMailing::query()->lockForUpdate()->findOrFail($mailing->id);
            abort_unless(in_array($locked->status, [PromotionMailingStatus::Ready, PromotionMailingStatus::Sending], true), 409);
            $locked->update(['status' => PromotionMailingStatus::Cancelled, 'completed_at' => now()]);
            $locked->recipients()->where('status', 'pending')->update(['status' => 'skipped', 'skip_reason' => 'Mailing annulé']);
        });
        $this->mailings->progress($mailing);

        return back()->with('success', 'Mailing annulé. Un message déjà en cours peut encore être envoyé.');
    }

    private function assertMailing(Promotion $promotion, PromotionMailing $mailing): void
    {
        $this->authorize('update', $promotion);
        abort_unless($mailing->promotion_id === $promotion->id, 404);
    }
}
