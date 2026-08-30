<?php

namespace App\Services;

use App\Domain\Promotions\Enums\CouponDiscountType;
use App\Models\PromotionCoupon;

final class PromotionCouponSimulationService
{
    /**
     * @return array{eligible_ht: float, discount_ht: float, final_ht: float, funder_margin_ht: float, funder_margin_after_ht: float, margin_sufficient: bool, minimum_reached: bool}
     */
    public function simulate(PromotionCoupon $coupon, float $eligibleHt, float $funderMarginHt, ?float $orderHt = null): array
    {
        $eligibleHt = round(max(0, $eligibleHt), 2);
        $funderMarginHt = round(max(0, $funderMarginHt), 2);
        $orderHt = round(max(0, $orderHt ?? $eligibleHt), 2);
        $minimumReached = $orderHt >= (float) $coupon->minimum_order_ht;

        $discountHt = 0.0;
        if ($minimumReached) {
            $discountHt = $coupon->discount_type === CouponDiscountType::Percent
                ? $eligibleHt * min(100, (float) $coupon->discount_value) / 100
                : (float) $coupon->discount_value;

            if ($coupon->maximum_discount_ht !== null) {
                $discountHt = min($discountHt, (float) $coupon->maximum_discount_ht);
            }

            $discountHt = round(min($discountHt, $eligibleHt), 2);
        }

        return [
            'eligible_ht' => $eligibleHt,
            'discount_ht' => $discountHt,
            'final_ht' => round($eligibleHt - $discountHt, 2),
            'funder_margin_ht' => $funderMarginHt,
            'funder_margin_after_ht' => round($funderMarginHt - $discountHt, 2),
            'margin_sufficient' => $discountHt <= $funderMarginHt,
            'minimum_reached' => $minimumReached,
        ];
    }
}
