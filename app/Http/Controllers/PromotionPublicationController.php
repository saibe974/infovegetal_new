<?php

namespace App\Http\Controllers;

use App\Domain\Promotions\Enums\PromotionStatus;
use App\Models\Promotion;
use App\Services\PromotionPageService;
use App\Services\PromotionWorkspaceDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PromotionPublicationController extends Controller
{
    public function __construct(private readonly PromotionWorkspaceDataService $workspace, private readonly PromotionPageService $pages) {}

    public function presentation(Promotion $promotion): Response
    {
        $this->authorize('update', $promotion);

        return Inertia::render('promotions/presentation', ['promotion' => $this->workspace->for($promotion)]);
    }

    public function updatePresentation(Request $request, Promotion $promotion): RedirectResponse
    {
        $this->authorize('update', $promotion);
        $data = $request->validate([
            'presentation_title' => ['nullable', 'string', 'max:255'],
            'presentation_body' => ['nullable', 'string', 'max:20000'],
            'terms' => ['nullable', 'string', 'max:10000'],
            'show_coupons' => ['required', 'boolean'],
        ]);
        $promotion->update($data);

        return back()->with('success', 'Présentation enregistrée.');
    }

    public function publication(Promotion $promotion): Response
    {
        $this->authorize('update', $promotion);

        return Inertia::render('promotions/publication', [
            'promotion' => $this->workspace->for($promotion),
            'publicationErrors' => $this->pages->publicationErrors($promotion),
            'visibleProductCount' => $this->pages->visibleProducts($promotion)->count(),
            'publishedAt' => $promotion->published_at?->toIso8601String(),
        ]);
    }

    public function updatePublication(Request $request, Promotion $promotion): RedirectResponse
    {
        $this->authorize('update', $promotion);
        $data = $request->validate(['action' => ['required', Rule::in(['publish', 'suspend', 'draft'])]]);
        DB::transaction(function () use ($promotion, $data): void {
            $locked = Promotion::query()->lockForUpdate()->findOrFail($promotion->id);
            if ($data['action'] === 'publish') {
                $errors = $this->pages->publicationErrors($locked);
                if ($errors) {
                    throw ValidationException::withMessages(['publication' => $errors]);
                }
                $locked->update([
                    'status' => $locked->starts_at?->isFuture() ? PromotionStatus::Scheduled : PromotionStatus::Active,
                    'published_at' => now(), 'suspended_at' => null,
                ]);
            } elseif ($data['action'] === 'suspend') {
                abort_unless(in_array($locked->status, [PromotionStatus::Active, PromotionStatus::Scheduled], true), 409);
                $locked->update(['status' => PromotionStatus::Suspended, 'suspended_at' => now()]);
            } else {
                abort_if($locked->status === PromotionStatus::Cancelled, 409);
                $locked->update(['status' => PromotionStatus::Draft, 'published_at' => null, 'suspended_at' => null]);
            }
        });

        return back()->with('success', 'Publication mise à jour. Aucun mailing n’a été envoyé.');
    }
}
