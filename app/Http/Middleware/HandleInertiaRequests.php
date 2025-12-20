<?php

namespace App\Http\Middleware;

// use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        // [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        // Load JSON translations for current locale with fallback
        $currentLocale = app()->getLocale();
        $fallbackLocale = config('app.fallback_locale');
        $i18n = [];
        foreach ([$currentLocale, $fallbackLocale] as $loc) {
            $path = base_path("lang/{$loc}.json");
            if (is_file($path)) {
                $json = json_decode((string) file_get_contents($path), true);
                if (is_array($json)) {
                    // Merge without overwriting existing keys (keep primary locale first)
                    $i18n = $i18n + $json;
                }
            }
        }

        $user = $request->user();
        $userArray = null;
        $impersonatorId = null;

        if ($user) {
            $user->loadMissing(['roles', 'permissions']);

            // Fusionner les permissions directes et celles héritées des rôles
            $allPermissions = $user->getAllPermissions()
                ->map(fn ($permission) => $permission->only(['id', 'name']))
                ->unique('id')
                ->values();

            $userArray = $user->toArray();
            $userArray['roles'] = $user->roles
                ->map(fn ($role) => $role->only(['id', 'name']))
                ->values();
            $userArray['permissions'] = $allPermissions;
            
            // Utiliser le service du package laravel-impersonate
            if ($user->isImpersonated()) {
                $impersonatorId = app('impersonate')->getImpersonatorId();
            }
        }

        // Get list of users for impersonation dropdown
        $users = \App\Models\User::select('id', 'name', 'email')->get();

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'locale' => app()->getLocale(),
            'i18n' => $i18n,
            // 'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $user ? $userArray : null,
                'impersonate_from' => $impersonatorId,
            ],
            'users' => $users,
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
            'query' => $request->query->all(),
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
