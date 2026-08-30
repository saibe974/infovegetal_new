<?php

namespace App\Http\Requests\Promotions;

use App\Models\Promotion;
use Illuminate\Foundation\Http\FormRequest;

class SavePromotionMailingRequest extends FormRequest
{
    public function authorize(): bool
    {
        $promotion = $this->route('promotion');

        return $promotion instanceof Promotion && $this->user()?->can('update', $promotion);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'subject' => ['required', 'string', 'max:255', 'not_regex:/[\r\n]/'],
            'preheader' => ['nullable', 'string', 'max:255'],
            'heading' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
            'cta_label' => ['nullable', 'required_with:cta_url', 'string', 'max:255'],
            'cta_url' => ['nullable', 'required_with:cta_label', 'url:http,https', 'max:2048'],
        ];
    }
}
