<?php

namespace App\Http\Requests\Promotions;

use App\Domain\Promotions\Enums\PromotionVisibility;
use App\Models\Promotion;
use App\Models\User;
use App\Services\PromotionAuthorizationService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdatePromotionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $promotion = $this->route('promotion');

        return $promotion instanceof Promotion
            && ($this->user()?->can('update', $promotion) ?? false);
    }

    public function rules(): array
    {
        $promotion = $this->route('promotion');

        return [
            'title' => ['required', 'string', 'min:2', 'max:255'],
            'slug' => [
                'nullable',
                'string',
                'max:255',
                'alpha_dash:ascii',
                Rule::unique('promotions', 'slug')->ignore($promotion instanceof Promotion ? $promotion->id : null),
            ],
            'description' => ['nullable', 'string', 'max:10000'],
            'responsible_user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(fn ($query) => $query->where('active', true)),
            ],
            'visibility' => ['required', Rule::enum(PromotionVisibility::class)],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $actor = $this->user();
            $responsibleId = (int) $this->input('responsible_user_id');
            $responsible = $responsibleId > 0 ? User::find($responsibleId) : null;

            if ($actor && $responsible && ! app(PromotionAuthorizationService::class)->canAssignResponsible($actor, $responsible)) {
                $validator->errors()->add('responsible_user_id', 'Ce responsable ne peut pas être affecté à cette promotion.');
            }
        }];
    }
}
