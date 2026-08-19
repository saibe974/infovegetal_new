<?php

namespace App\Http\Requests\Users;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'alias' => ['nullable', 'string', 'max:255', 'unique:users,alias'],
            'ref' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:25'],
            'address_road' => ['nullable', 'string', 'max:255'],
            'address_zip' => ['nullable', 'string', 'max:32'],
            'address_town' => ['nullable', 'string', 'max:120'],
            'active' => ['sometimes', 'boolean'],
            'mailing' => ['sometimes', 'boolean'],
            'email' => ['nullable', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:8'],
            'roles' => ['sometimes', 'array'],
            'roles.*' => ['integer', 'exists:roles,id'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
            'parent_id' => ['nullable', 'integer', 'exists:users,id'],
            'sync_metas' => ['sometimes', 'boolean'],
            'metas' => ['sometimes', 'array'],
            'metas.*.id' => ['nullable', 'integer'],
            'metas.*.key' => ['required', 'string', 'max:255', Rule::notIn(['logo'])],
            'metas.*.title' => ['required', 'string', 'max:255'],
            'metas.*.value' => ['nullable', 'string'],
            'metas.*.value_json' => ['nullable', 'array'],
            'metas.*.value_file' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf', 'max:10240'],
            'metas.*.type' => ['nullable', 'string', 'max:50'],
            'metas.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
