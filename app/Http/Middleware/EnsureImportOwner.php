<?php

namespace App\Http\Middleware;

use App\Models\File;
use Closure;
use Illuminate\Http\Request;

class EnsureImportOwner
{
    public function handle(Request $request, Closure $next)
    {
        $id = $request->route('id') ?? $request->input('id');
        abort_unless(is_scalar($id) && preg_match('/\A[1-9][0-9]*\z/', (string) $id), 422);
        abort_unless(File::query()->whereKey($id)->where('user_id', $request->user()?->id)->exists(), 404);

        return $next($request);
    }
}
