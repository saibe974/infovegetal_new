<?php

namespace App\Http\Requests\Promotions;

use App\Domain\Promotions\Enums\CouponDiscountType;
use App\Domain\Promotions\Enums\CouponFunder;
use App\Domain\Promotions\Enums\CouponScope;
use App\Models\Promotion;
use App\Models\PromotionCoupon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SavePromotionCouponRequest extends FormRequest
{
    public function authorize(): bool
    {
        $promotion = $this->route('promotion');

        return $promotion instanceof Promotion && $this->user()?->can('update', $promotion);
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'code' => mb_strtoupper(trim((string) $this->input('code'))),
        ]);
    }

    public function rules(): array
    {
        $coupon = $this->route('coupon');
        $couponId = $coupon instanceof PromotionCoupon ? $coupon->id : null;

        return [
            'code' => ['required', 'string', 'max:64', 'regex:/^[A-Z0-9][A-Z0-9_-]*$/', Rule::unique('promotion_coupons', 'code')->ignore($couponId)],
            'discount_type' => ['required', Rule::enum(CouponDiscountType::class)],
            'discount_value' => ['required', 'numeric', 'gt:0', Rule::when($this->input('discount_type') === CouponDiscountType::Percent->value, ['max:100'])],
            'scope' => ['required', Rule::enum(CouponScope::class)],
            'funded_by' => ['required', Rule::enum(CouponFunder::class)],
            'minimum_order_ht' => ['required', 'numeric', 'min:0'],
            'maximum_discount_ht' => ['nullable', 'numeric', 'gt:0'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'usage_limit_per_customer' => ['required', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date'],
            'stackable_with_promo_price' => ['required', 'boolean'],
            'active' => ['required', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $promotion = $this->route('promotion');
            if (! $promotion instanceof Promotion) {
                return;
            }

            $startsAt = $this->date('starts_at') ?? $promotion->starts_at;
            $endsAt = $this->date('ends_at') ?? $promotion->ends_at;

            if ($startsAt && $endsAt && $endsAt->lessThanOrEqualTo($startsAt)) {
                $validator->errors()->add('ends_at', 'La fin du coupon doit être postérieure à son début effectif.');
            }
        }];
    }
}
