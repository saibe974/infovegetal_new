<?php

namespace App\Services;

use App\Domain\Promotions\Enums\PromotionStatus;
use App\Domain\Promotions\Enums\PromotionVisibility;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionCoupon;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

final class PromotionPageService
{
    public function canVisit(Promotion $promotion, ?User $user): bool
    {
        if (! $promotion->isLiveAt()) {
            return false;
        }

        return match ($promotion->visibility) {
            PromotionVisibility::Public, PromotionVisibility::Unlisted => true,
            PromotionVisibility::Authenticated => $user && $user->active,
            PromotionVisibility::Targeted => $user && $user->active && $promotion->audienceUsers()->whereKey($user->id)->exists(),
        };
    }

    public function listedQuery(?User $user): Builder
    {
        return Promotion::query()->effectiveStatus(PromotionStatus::Active)
            ->where(function (Builder $query) use ($user): void {
                $query->where('visibility', PromotionVisibility::Public);
                if ($user?->active) {
                    $query->orWhere('visibility', PromotionVisibility::Authenticated)
                        ->orWhere(fn (Builder $q) => $q->where('visibility', PromotionVisibility::Targeted)
                            ->whereHas('audienceUsers', fn (Builder $audience) => $audience->where('users.id', $user->id)));
                }
            });
    }

    public function visibleProducts(Promotion $promotion): Collection
    {
        return $promotion->products()->with('media')->get()->filter(function (Product $product): bool {
            if (! $product->active || $product->available_until?->isPast()) {
                return false;
            }

            return $product->isOrderableAt() || ($product->availabilityStatusAt() === 'upcoming' && $product->pivot->show_before_availability);
        })->values();
    }

    public function data(Promotion $promotion): array
    {
        // Explicit public fields only: never serialize the manager model, purchasing prices or margins.
        return [
            'title' => $promotion->presentation_title ?: $promotion->title,
            'body' => $promotion->presentation_body,
            'terms' => $promotion->terms,
            'url' => route('offers.show', $promotion->slug),
            'ends_at' => $promotion->ends_at?->toIso8601String(),
            'products' => $this->visibleProducts($promotion)->map(fn (Product $product) => [
                'id' => $product->id,
                'title' => $product->pivot->custom_title ?: $product->name,
                'description' => $product->pivot->custom_description,
                'image' => $product->getFirstMediaUrl('images', 'thumb') ?: $product->getFirstMediaUrl('images') ?: $this->safeImageUrl($product->img_link),
                'featured' => (bool) $product->pivot->featured,
                'available_from' => $product->available_from?->toIso8601String(),
                'orderable' => $product->isOrderableAt(),
                'url' => $product->isOrderableAt() ? route('products.show', $product) : null,
            ])->all(),
            'coupons' => $promotion->show_coupons ? $promotion->coupons()->where('active', true)->get()
                ->filter(fn (PromotionCoupon $coupon) => ! $coupon->effective_starts_at?->isFuture() && ! $coupon->effective_ends_at?->isPast())
                ->map(fn (PromotionCoupon $coupon) => [
                    'code' => $coupon->code,
                    'discount_type' => $coupon->discount_type->value,
                    'discount_value' => $coupon->discount_value,
                    'scope' => $coupon->scope->value,
                    'minimum_order_ht' => $coupon->minimum_order_ht,
                    'maximum_discount_ht' => $coupon->maximum_discount_ht,
                    'stackable_with_promo_price' => $coupon->stackable_with_promo_price,
                    'usage_limit_per_customer' => $coupon->usage_limit_per_customer,
                    'ends_at' => $coupon->effective_ends_at?->toIso8601String(),
                ])->values()->all() : [],
        ];
    }

    private function safeImageUrl(?string $url): ?string
    {
        return $url && (preg_match('#^https?://#i', $url) || (str_starts_with($url, '/') && ! str_starts_with($url, '//'))) ? $url : null;
    }

    public function publicationErrors(Promotion $promotion): array
    {
        $errors = [];
        if ($promotion->ends_at?->isPast()) {
            $errors[] = 'La date de fin est déjà passée.';
        }
        if ($promotion->starts_at && $promotion->ends_at && $promotion->ends_at->lte($promotion->starts_at)) {
            $errors[] = 'La date de fin doit être postérieure au début.';
        }
        if (! filled($promotion->presentation_body) && ! $promotion->products()->where('active', true)->exists()
            && ! ($promotion->show_coupons && $promotion->coupons()->where('active', true)->exists())) {
            $errors[] = 'Ajoutez un texte de présentation, une sélection active ou des coupons affichables.';
        }
        if ($promotion->visibility === PromotionVisibility::Targeted && ! $promotion->audienceUsers()->where('active', true)->exists()) {
            $errors[] = 'Une promotion ciblée nécessite une audience active.';
        }
        if ($promotion->status === PromotionStatus::Cancelled) {
            $errors[] = 'Cette promotion a été annulée.';
        }

        return $errors;
    }
}
