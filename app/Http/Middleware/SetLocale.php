<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $allowed = ['en', 'fr', 'es', 'nl', 'de', 'it'];

        $locale = null;
        
        // 1. Vérifier le cookie
        if ($request->hasCookie('locale')) {
            $locale = $request->cookie('locale');
        }
        
        // 2. Sinon, vérifier la session
        if (!$locale && $request->session()->has('locale')) {
            $locale = $request->session()->get('locale');
        }
        
        // 3. Sinon, utiliser la locale du navigateur
        if (!$locale) {
            $browserLocale = $request->getPreferredLanguage($allowed);
            if ($browserLocale) {
                $locale = $browserLocale;
            }
        }

        // 4. Vérifier que la locale est autorisée, sinon utiliser celle par défaut
        if (!in_array($locale, $allowed, true)) {
            $locale = config('app.locale');
        }

        app()->setLocale($locale);

        return $next($request);
    }
}
