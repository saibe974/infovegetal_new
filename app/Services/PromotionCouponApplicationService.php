<?php

namespace App\Services;

use App\Domain\Promotions\Enums\CouponFunder;
use App\Domain\Promotions\Enums\CouponScope;
use App\Domain\Promotions\Enums\PromotionVisibility;
use App\Models\Cart;
use App\Models\PromotionCoupon;
use App\Models\PromotionCouponRedemption;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class PromotionCouponApplicationService
{
    public function __construct(
        private readonly PromotionCouponSimulationService $simulation,
        private readonly OrderSnapshotService $orders,
    ) {}

    public function findByCode(string $code): PromotionCoupon
    {
        $coupon = PromotionCoupon::query()
            ->with('promotion')
            ->where('code', mb_strtoupper(trim($code)))
            ->first();

        if (! $coupon) {
            throw ValidationException::withMessages(['coupon_code' => 'Ce code promotionnel est inconnu.']);
        }

        return $coupon;
    }

    /**
     * @param  Collection<int, array{product: mixed, quantity: int, line_total: float|int}>  $items
     * @return array{coupon: PromotionCoupon, code: string, eligible_ht: float, discount_ht: float, final_ht: float, funded_by: string, funder_margin_ht: float, funder_margin_after_ht: float}
     */
    public function evaluate(
        PromotionCoupon $coupon,
        User $user,
        Collection $items,
        float $shippingHt,
        ?Cart $cart = null,
    ): array {
        $coupon->loadMissing('promotion');
        $now = now();

        if (! $coupon->active || ! $coupon->promotion?->isLiveAt($now)) {
            throw ValidationException::withMessages(['coupon_code' => 'Ce coupon n’est pas actif.']);
        }

        if (
            $coupon->promotion->visibility === PromotionVisibility::Targeted
            && ! $coupon->promotion->audienceUsers()->whereKey($user->id)->exists()
        ) {
            throw ValidationException::withMessages(['coupon_code' => 'Ce coupon n’est pas disponible pour votre compte.']);
        }

        if ($coupon->effective_starts_at && $now->lt($coupon->effective_starts_at)) {
            throw ValidationException::withMessages(['coupon_code' => 'Ce coupon n’est pas encore disponible.']);
        }

        if ($coupon->effective_ends_at && $now->gt($coupon->effective_ends_at)) {
            throw ValidationException::withMessages(['coupon_code' => 'Ce coupon a expiré.']);
        }

        $this->assertUsageAvailable($coupon, $user, $cart);

        $eligibleItems = $items;
        if ($coupon->scope === CouponScope::PromotionProducts) {
            $productIds = $coupon->promotion->products()->pluck('products.id')->map(fn ($id) => (int) $id);
            $eligibleItems = $eligibleItems->filter(fn ($item) => $productIds->contains((int) $item['product']->id));
        }

        if (! $coupon->stackable_with_promo_price) {
            $eligibleItems = $eligibleItems->filter(fn ($item) => (float) ($item['product']->price_promo ?? 0) <= 0);
        }

        if ($eligibleItems->isEmpty()) {
            throw ValidationException::withMessages(['coupon_code' => 'Aucun produit du panier n’est éligible à ce coupon.']);
        }

        $itemsHt = round((float) $items->sum(fn ($item) => (float) ($item['line_total'] ?? 0)), 2);
        $eligibleHt = round((float) $eligibleItems->sum(fn ($item) => (float) ($item['line_total'] ?? 0)), 2);
        if ($coupon->scope === CouponScope::Cart) {
            $eligibleHt = round($eligibleHt + max(0, $shippingHt), 2);
        }

        $margins = $this->orders->estimateActorMargins($user, $eligibleItems->values());
        $funderKey = $coupon->funded_by === CouponFunder::BillingUser ? 'billing_user' : 'seller';
        $result = $this->simulation->simulate(
            $coupon,
            $eligibleHt,
            $margins[$funderKey],
            round($itemsHt + max(0, $shippingHt), 2),
        );

        if (! $result['minimum_reached']) {
            throw ValidationException::withMessages([
                'coupon_code' => 'Le minimum de commande HT requis pour ce coupon n’est pas atteint.',
            ]);
        }

        if ($result['discount_ht'] <= 0) {
            throw ValidationException::withMessages(['coupon_code' => 'Ce coupon ne produit aucune remise sur ce panier.']);
        }

        if (! $result['margin_sufficient']) {
            throw ValidationException::withMessages([
                'coupon_code' => 'La remise dépasse la marge disponible du financeur.',
            ]);
        }

        return [
            'coupon' => $coupon,
            'code' => $coupon->code,
            'eligible_ht' => $result['eligible_ht'],
            'discount_ht' => $result['discount_ht'],
            'final_ht' => $result['final_ht'],
            'funded_by' => $coupon->funded_by->value,
            'funder_margin_ht' => $result['funder_margin_ht'],
            'funder_margin_after_ht' => $result['funder_margin_after_ht'],
        ];
    }

    /**
     * @param  Collection<int, array{product: mixed, quantity: int, line_total: float|int}>  $items
     */
    public function consume(
        PromotionCoupon $coupon,
        User $user,
        Cart $cart,
        Collection $items,
        float $shippingHt,
    ): PromotionCouponRedemption {
        return DB::transaction(function () use ($coupon, $user, $cart, $items, $shippingHt): PromotionCouponRedemption {
            $existing = PromotionCouponRedemption::query()->where('cart_id', $cart->id)->first();
            if ($existing) {
                if ($existing->promotion_coupon_id !== $coupon->id) {
                    throw ValidationException::withMessages(['coupon_code' => 'Cette commande a déjà consommé un autre coupon.']);
                }

                return $existing;
            }

            $lockedCoupon = PromotionCoupon::query()->with('promotion')->lockForUpdate()->findOrFail($coupon->id);
            $result = $this->evaluate($lockedCoupon, $user, $items, $shippingHt, $cart);

            return PromotionCouponRedemption::create([
                'promotion_coupon_id' => $lockedCoupon->id,
                'promotion_id' => $lockedCoupon->promotion_id,
                'cart_id' => $cart->id,
                'user_id' => $user->id,
                'discount_amount_ht' => $result['discount_ht'],
                'used_at' => now(),
            ]);
        });
    }

    private function assertUsageAvailable(PromotionCoupon $coupon, User $user, ?Cart $cart): void
    {
        if ($cart && $coupon->redemptions()->where('cart_id', $cart->id)->exists()) {
            return;
        }

        if ($coupon->usage_limit !== null && $coupon->redemptions()->count() >= $coupon->usage_limit) {
            throw ValidationException::withMessages(['coupon_code' => 'La limite globale de ce coupon est atteinte.']);
        }

        if ($coupon->redemptions()->where('user_id', $user->id)->count() >= $coupon->usage_limit_per_customer) {
            throw ValidationException::withMessages(['coupon_code' => 'Vous avez déjà utilisé ce coupon.']);
        }
    }
}
