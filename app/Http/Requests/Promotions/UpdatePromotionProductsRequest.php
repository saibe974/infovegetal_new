<?php

namespace App\Http\Requests\Promotions;

use App\Models\Promotion;
use App\Services\PromotionProductCatalogService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdatePromotionProductsRequest extends FormRequest
{
    public function authorize(): bool
    {
        $promotion = $this->route('promotion');

        return $promotion instanceof Promotion
            && ($this->user()?->can('update', $promotion) ?? false);
    }

    public function rules(): array
    {
        return [
            'products' => ['present', 'array', 'max:'.Promotion::MAX_SELECTED_PRODUCTS],
            'products.*.id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'products.*.featured' => ['required', 'boolean'],
            'products.*.show_before_availability' => ['required', 'boolean'],
            'products.*.custom_title' => ['nullable', 'string', 'max:255'],
            'products.*.custom_description' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'products.max' => 'La sélection ne peut pas dépasser :max produits.',
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || ! $this->user()) {
                return;
            }

            $ids = collect($this->input('products', []))
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();

            if ($ids->isEmpty()) {
                return;
            }

            $allowedCount = app(PromotionProductCatalogService::class)
                ->selectableQuery($this->user())
                ->whereIn('id', $ids->all())
                ->count();

            if ($allowedCount !== $ids->count()) {
                $validator->errors()->add('products', 'La sélection contient un produit inactif ou hors de votre périmètre.');
            }
        }];
    }
}
