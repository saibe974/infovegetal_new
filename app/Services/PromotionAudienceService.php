<?php

namespace App\Services;

use App\Models\Promotion;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

final class PromotionAudienceService
{
    public function __construct(private readonly PromotionAuthorizationService $authorization) {}

    public function eligibleQuery(User $user, Promotion $promotion): Builder
    {
        $actor = $this->authorization->resolveActor($user);
        $query = User::query()->where('active', true);

        // This exception belongs to the promotion's responsible, not its current editor.
        if ((int) $promotion->responsible_user_id === 1 || $promotion->responsible?->hasRole('admin')) {
            return $query;
        }

        $query->whereHas('roles', fn (Builder $roleQuery) => $roleQuery->where('name', 'client'));

        if ($this->authorization->canManageAll($actor)) {
            return $query;
        }

        return $query
            ->whereNotNull('_lft')
            ->whereNotNull('_rgt')
            ->where('_lft', '>', $actor->_lft)
            ->where('_rgt', '<', $actor->_rgt);
    }

    public function filteredQuery(User $user, Promotion $promotion, array $filters): Builder
    {
        $query = $this->eligibleQuery($user, $promotion);
        $search = trim((string) ($filters['q'] ?? ''));

        if ($search !== '') {
            $query->where(function (Builder $searchQuery) use ($search): void {
                $searchQuery
                    ->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('ref', 'like', '%'.$search.'%')
                    ->orWhere('address_town', 'like', '%'.$search.'%');
            });
        }

        if (($filters['mailing'] ?? null) === 'yes') {
            $query->where('mailing', true);
        } elseif (($filters['mailing'] ?? null) === 'no') {
            $query->where('mailing', false);
        }

        return $query;
    }

    public function assertEligibleIds(User $user, Promotion $promotion, array $ids): void
    {
        $ids = collect($ids)->map(fn ($id) => (int) $id)->unique()->values();
        $eligibleCount = $this->eligibleQuery($user, $promotion)->whereKey($ids)->count();

        abort_unless($eligibleCount === $ids->count(), 403, 'Certains utilisateurs ne font pas partie du périmètre autorisé.');
    }
}
