<?php

namespace App\Http\Requests\Settings;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProfileUpdateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $ignoreId = $this->route('user') ? (is_object($this->route('user')) ? $this->route('user')->id : $this->route('user')) : $this->user()->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'alias' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique(User::class, 'alias')->ignore($ignoreId),
            ],
            'ref' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:25'],
            'address_road' => ['nullable', 'string', 'max:255'],
            'address_zip' => ['nullable', 'string', 'max:32'],
            'address_town' => ['nullable', 'string', 'max:120'],
            'mailing' => ['nullable', 'boolean'],
            'active' => ['nullable', 'boolean'],

            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($ignoreId),
            ],
            'locale' => ['nullable', 'string', Rule::in(['en', 'fr', 'es', 'nl', 'de', 'it'])],
        ];
    }
}
