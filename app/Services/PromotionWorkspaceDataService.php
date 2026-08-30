<?php

namespace App\Services;

use App\Models\Promotion;

final class PromotionWorkspaceDataService
{
    public function for(Promotion $promotion): array
    {
        return [
            'id' => $promotion->id,
            'title' => $promotion->title,
            'slug' => $promotion->slug,
            'description' => $promotion->description,
            'status' => $promotion->effectiveStatusAt()->value,
            'presentation_title' => $promotion->presentation_title,
            'presentation_body' => $promotion->presentation_body,
            'terms' => $promotion->terms,
            'show_coupons' => (bool) $promotion->show_coupons,
            'public_url' => route('offers.show', $promotion->slug),
            'visibility' => $promotion->visibility->value,
            'created_by_id' => $promotion->created_by_id,
            'responsible_user_id' => $promotion->responsible_user_id,
            'creator' => $promotion->creator?->only(['id', 'name']),
            'responsible' => $promotion->responsible?->only(['id', 'name']),
            'starts_at' => $promotion->starts_at?->format('Y-m-d\TH:i'),
            'ends_at' => $promotion->ends_at?->format('Y-m-d\TH:i'),
            'created_at' => $promotion->created_at?->toIso8601String(),
            'updated_at' => $promotion->updated_at?->toIso8601String(),
        ];
    }
}
