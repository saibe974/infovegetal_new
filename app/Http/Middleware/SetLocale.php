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
        
        // 1. Priorité à l'utilisateur connecté
        if ($request->user() && $request->user()->locale) {
            $locale = $request->user()->locale;
        }
        
        // 2. Si pas d'utilisateur connecté, vérifier le cookie
        if (!$locale && $request->hasCookie('locale')) {
            $locale = $request->cookie('locale');
        }
        
        // 3. Sinon, vérifier la session
        if (!$locale && $request->session()->has('locale')) {
            $locale = $request->session()->get('locale');
        }
        
        // 4. Sinon, utiliser la locale du navigateur
        if (!$locale) {
            $browserLocale = $request->getPreferredLanguage($allowed);
            if ($browserLocale) {
                $locale = $browserLocale;
            }
        }

        // 5. Vérifier que la locale est autorisée, sinon utiliser celle par défaut
        if (!in_array($locale, $allowed, true)) {
            $locale = config('app.locale');
        }

        app()->setLocale($locale);

        return $next($request);
    }
}
