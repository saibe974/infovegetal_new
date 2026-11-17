<?php

namespace App\Http\Middleware;

use App\Support\ElfinderRoots;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricts the elFinder volumes to what the current user may see.
 */
class ConfigureElfinderRoots
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        abort_unless($user, 403);

        config(['elfinder.roots' => ElfinderRoots::forUser($user)]);

        return $next($request);
    }
}
