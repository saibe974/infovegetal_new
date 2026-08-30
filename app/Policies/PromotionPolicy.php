<?php

namespace App\Policies;

use App\Models\Promotion;
use App\Models\User;
use App\Services\PromotionAuthorizationService;

final class PromotionPolicy
{
    public function __construct(private readonly PromotionAuthorizationService $authorization) {}

    public function viewAny(User $user): bool
    {
        return $this->authorization->canViewModule($user);
    }

    public function view(User $user, Promotion $promotion): bool
    {
        return $this->authorization->canView($user, $promotion);
    }

    public function create(User $user): bool
    {
        return $this->authorization->canManageModule($user);
    }

    public function update(User $user, Promotion $promotion): bool
    {
        return $this->authorization->canUpdate($user, $promotion);
    }
}
