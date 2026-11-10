<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkUpdateProductsRequest extends FormRequest
{
    public const FIELDS = [
        'name', 'description', 'category_products_id', 'pot', 'height',
        'cond', 'floor', 'roll', 'price', 'price_floor', 'price_promo', 'price_roll',
        'available_from', 'available_until', 'active',
    ];

    public function authorize(): bool
    {
        return true; // Protected by the same admin middleware as individual editing.
    }

    public function rules(): array
    {
        $productRules = (new FormProductRequest)->rules();
        $rules = [
            'selection' => ['required', 'uuid'],
            'changes' => ['present', 'array:'.implode(',', self::FIELDS)],
            'tags_mode' => ['required', Rule::in(['keep', 'add', 'remove'])],
            'tags' => ['required_unless:tags_mode,keep', 'array', 'max:100'],
            'tags.*' => $productRules['tags.*'],
        ];

        foreach (self::FIELDS as $field) {
            $rules['changes.'.$field] = ['sometimes', ...match ($field) {
                'active' => ['required', 'boolean'],
                'name' => ['required', 'string', 'min:3', 'max:255'],
                // Validate against each product's resulting dates in the transaction.
                'available_until' => ['nullable', 'date'],
                // The base price is not nullable in the database.
                'price' => ['required', 'numeric', 'min:0'],
                default => $productRules[$field],
            }];
        }

        return $rules;
    }

    public function after(): array
    {
        return [function ($validator) {
            if ($this->input('changes', []) === [] && $this->input('tags_mode') === 'keep') {
                $validator->errors()->add('changes', 'Choisissez au moins une modification.');
            }
        }];
    }
}
