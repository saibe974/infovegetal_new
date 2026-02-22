<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class FormProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        Log::info('[FORM_REQUEST] Authorization check for user:', ['user_id' => Auth::id()]);
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        Log::info('[FORM_REQUEST] Validation rules applied');
        return [
            'name' => ['required', 'string', 'min:3'],
            'sku' => ['required', 'string', 'max:255'],
            'ref' => ['nullable', 'string', 'max:255'],
            'ean13' => ['nullable', 'string', 'max:13'],
            'description' => ['nullable', 'string'],
            'img_link' => ['nullable', 'string', 'max:2048'],
            'tags' => ['nullable'],
            'pot' => ['nullable', 'numeric', 'min:0'],
            'height' => ['nullable', 'regex:/^\d+(-\d+)?$/', 'max:20'],
            'cond' => ['nullable', 'integer', 'min:0'],
            'floor' => ['nullable', 'integer', 'min:0'],
            'roll' => ['nullable', 'integer', 'min:0'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'price_floor' => ['nullable', 'numeric', 'min:0'],
            'price_promo' => ['nullable', 'numeric', 'min:0'],
            'price_roll' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
