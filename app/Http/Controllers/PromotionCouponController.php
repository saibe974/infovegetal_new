<?php

namespace App\Http\Controllers;

use App\Http\Requests\Promotions\SavePromotionCouponRequest;
use App\Models\Promotion;
use App\Models\PromotionCoupon;
use App\Services\PromotionCouponSimulationService;
use App\Services\PromotionWorkspaceDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PromotionCouponController extends Controller
{
    public function __construct(private readonly PromotionWorkspaceDataService $workspaceData) {}

    public function edit(Promotion $promotion): Response
    {
        $this->authorize('update', $promotion);
        $promotion->load(['creator:id,name', 'responsible:id,name', 'coupons']);

        return Inertia::render('promotions/coupons', [
            'promotion' => $this->promotionData($promotion),
            'coupons' => $promotion->coupons->map(fn (PromotionCoupon $coupon) => $this->couponData($coupon))->values(),
        ]);
    }

    public function store(SavePromotionCouponRequest $request, Promotion $promotion): RedirectResponse
    {
        $promotion->coupons()->create($request->validated());

        return back()->with('success', 'Coupon créé.');
    }

    public function update(SavePromotionCouponRequest $request, Promotion $promotion, PromotionCoupon $coupon): RedirectResponse
    {
        $this->assertBelongsToPromotion($promotion, $coupon);
        $coupon->update($request->validated());

        return back()->with('success', 'Coupon enregistré.');
    }

    public function destroy(Request $request, Promotion $promotion, PromotionCoupon $coupon): RedirectResponse
    {
        $this->authorize('update', $promotion);
        $this->assertBelongsToPromotion($promotion, $coupon);
        $coupon->delete();

        return back()->with('success', 'Coupon supprimé.');
    }

    public function simulate(
        Request $request,
        Promotion $promotion,
        PromotionCoupon $coupon,
        PromotionCouponSimulationService $simulation,
    ): JsonResponse {
        $this->authorize('update', $promotion);
        $this->assertBelongsToPromotion($promotion, $coupon);
        $data = $request->validate([
            'eligible_ht' => ['required', 'numeric', 'min:0'],
            'funder_margin_ht' => ['required', 'numeric', 'min:0'],
        ]);

        return response()->json($simulation->simulate(
            $coupon,
            (float) $data['eligible_ht'],
            (float) $data['funder_margin_ht'],
        ));
    }

    private function assertBelongsToPromotion(Promotion $promotion, PromotionCoupon $coupon): void
    {
        if ($coupon->promotion_id !== $promotion->id) {
            throw ValidationException::withMessages(['coupon' => 'Ce coupon n’appartient pas à cette promotion.']);
        }
    }

    private function promotionData(Promotion $promotion): array
    {
        return $this->workspaceData->for($promotion);
    }

    private function couponData(PromotionCoupon $coupon): array
    {
        return [
            'id' => $coupon->id,
            'code' => $coupon->code,
            'discount_type' => $coupon->discount_type->value,
            'discount_value' => (float) $coupon->discount_value,
            'scope' => $coupon->scope->value,
            'funded_by' => $coupon->funded_by->value,
            'minimum_order_ht' => (float) $coupon->minimum_order_ht,
            'maximum_discount_ht' => $coupon->maximum_discount_ht !== null ? (float) $coupon->maximum_discount_ht : null,
            'usage_limit' => $coupon->usage_limit,
            'usage_limit_per_customer' => $coupon->usage_limit_per_customer,
            'starts_at' => $coupon->starts_at?->format('Y-m-d\TH:i'),
            'ends_at' => $coupon->ends_at?->format('Y-m-d\TH:i'),
            'effective_starts_at' => $coupon->effective_starts_at?->format('Y-m-d\TH:i'),
            'effective_ends_at' => $coupon->effective_ends_at?->format('Y-m-d\TH:i'),
            'stackable_with_promo_price' => $coupon->stackable_with_promo_price,
            'active' => $coupon->active,
        ];
    }
}
