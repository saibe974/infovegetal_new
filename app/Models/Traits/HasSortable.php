<?php

namespace App\Models\Traits;

use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

trait HasSortable
{
    #[Scope]
    protected function orderFromRequest(Builder $builder, Request $request)
    {
        if (empty($this->sortable ?? [])) {
            return;
        }

        $validated = $request->validate([
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'sort' => ['nullable', Rule::in($this->sortable)],
        ]);

        if (! ($validated['sort'] ?? null)) {
            $builder->orderByDesc('created_at');
            return;
        }

        $builder->orderBy($validated['sort'], $validated['dir'] ?? 'desc');
    }
}
