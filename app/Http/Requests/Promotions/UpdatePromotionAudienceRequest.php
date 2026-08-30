<?php

namespace App\Http\Requests\Promotions;

use App\Domain\Promotions\Enums\PromotionAudienceMode;
use App\Models\Promotion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePromotionAudienceRequest extends FormRequest
{
    public function authorize(): bool
    {
        $promotion = $this->route('promotion');

        return $promotion instanceof Promotion && $this->user()?->can('update', $promotion);
    }

    public function rules(): array
    {
        return [
            'audience_mode' => ['required', Rule::enum(PromotionAudienceMode::class)],
            'user_ids' => ['present', 'array'],
            'user_ids.*' => ['integer', 'distinct', 'exists:users,id'],
        ];
    }
}
