<?php

namespace App\Http\Controllers;

use App\Domain\Promotions\Enums\PromotionAudienceMode;
use App\Http\Requests\Promotions\UpdatePromotionAudienceRequest;
use App\Models\Promotion;
use App\Models\User;
use App\Services\PromotionAudienceService;
use App\Services\PromotionWorkspaceDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PromotionAudienceController extends Controller
{
    public function __construct(
        private readonly PromotionAudienceService $audience,
        private readonly PromotionWorkspaceDataService $workspaceData,
    ) {}

    public function edit(Request $request, Promotion $promotion): Response
    {
        $this->authorize('update', $promotion);
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'mailing' => ['nullable', Rule::in(['all', 'yes', 'no'])],
        ]);
        $promotion->load(['creator:id,name', 'responsible:id,name']);
        $selectedIds = $promotion->audienceUsers()->pluck('users.id')->map(fn ($id) => (int) $id);

        $candidates = $this->audience
            ->filteredQuery($request->user(), $promotion, $filters)
            ->with('parent:id,name')
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (User $user) => $this->userData($user, $selectedIds->contains($user->id)));

        $selectedUsers = User::query()
            ->whereKey($selectedIds)
            ->with('parent:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->userData($user, true));
        $eligibleQuery = $this->audience->eligibleQuery($request->user(), $promotion);

        return Inertia::render('promotions/audience', [
            'promotion' => $this->workspaceData->for($promotion),
            'audienceMode' => $promotion->audience_mode->value,
            'audienceUpdatedAt' => $promotion->audience_updated_at?->toIso8601String(),
            'selectedUsers' => $selectedUsers,
            'candidates' => JsonResource::collection($candidates),
            'counts' => [
                'eligible' => (clone $eligibleQuery)->count(),
                'eligible_mailing' => (clone $eligibleQuery)->where('mailing', true)->count(),
                'selected' => $selectedIds->count(),
                'selected_mailing' => $selectedUsers->where('mailing', true)->count(),
            ],
            'filters' => [
                'q' => $filters['q'] ?? '',
                'mailing' => $filters['mailing'] ?? 'all',
            ],
        ]);
    }

    public function update(UpdatePromotionAudienceRequest $request, Promotion $promotion): RedirectResponse
    {
        $data = $request->validated();
        $mode = PromotionAudienceMode::from($data['audience_mode']);
        $ids = $mode === PromotionAudienceMode::AllAccessible
            ? $this->audience->eligibleQuery($request->user(), $promotion)->pluck('users.id')->all()
            : array_map('intval', $data['user_ids']);

        if ($mode === PromotionAudienceMode::Selected) {
            $this->audience->assertEligibleIds($request->user(), $promotion, $ids);
        }

        DB::transaction(function () use ($promotion, $mode, $ids): void {
            $promotion->audienceUsers()->sync($ids);
            $promotion->update([
                'audience_mode' => $mode,
                'audience_updated_at' => now(),
            ]);
        });

        return back()->with('success', 'Audience enregistrée.');
    }

    public function propositions(Request $request, Promotion $promotion): JsonResponse
    {
        $this->authorize('update', $promotion);
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'mailing' => ['nullable', Rule::in(['all', 'yes', 'no'])],
        ]);

        $propositions = mb_strlen(trim($filters['q'] ?? '')) < 2
            ? []
            : $this->audience->filteredQuery($request->user(), $promotion, $filters)
                ->orderBy('name')->orderBy('id')->limit(10)
                ->get(['id', 'name', 'email', 'ref', 'address_town'])
                ->map(fn (User $user) => [
                    'value' => $user->email,
                    'label' => $user->name,
                    'description' => collect([$user->email, $user->ref, $user->address_town])->filter()->implode(' · '),
                ])->all();

        return response()->json(['propositions' => $propositions])->header('Cache-Control', 'private, no-store');
    }

    private function userData(User $user, bool $selected): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'ref' => $user->ref,
            'address_town' => $user->address_town,
            'mailing' => (bool) $user->mailing,
            'parent' => $user->parent?->only(['id', 'name']),
            'selected' => $selected,
        ];
    }
}
