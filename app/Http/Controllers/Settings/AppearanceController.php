<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserMeta;
use App\Services\PromotionAuthorizationService;
use App\Services\UserManagementAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AppearanceController extends Controller
{
    /**
     * Modes d'affichage autorisés pour chaque page de préférences.
     */
    private const PAGE_VIEWS = [
        'dashboard' => ['table'],
        'products' => ['table', 'list', 'grid'],
        'offers' => ['table'],
        'categories' => ['table'],
        'tags' => ['table'],
        'db-products' => ['table'],
        'missing-images' => ['table'],
        'users' => ['accordion', 'grid'],
        'promotions' => ['table'],
        'carriers' => ['table'],
        'media' => ['table'],
    ];

    public function __construct(
        private readonly UserManagementAuthorizationService $authorization,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public static function preferencesFor(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        $value = $user->usersMeta()
            ->where('key', UserMeta::APPEARANCE_PREFERENCES_KEY)
            ->value('value');

        if (! is_string($value)) {
            return null;
        }

        $preferences = json_decode($value, true);

        return is_array($preferences) ? $preferences : null;
    }

    public function editGuest(): Response
    {
        return Inertia::render('appearance');
    }

    public function edit(Request $request, ?User $user = null): Response
    {
        $target = $user ?? $request->user();

        $this->authorize('update', $target);

        return Inertia::render('settings/appearance', [
            'editingUser' => $target->loadMissing(['roles', 'permissions']),
            'appearancePreferences' => self::preferencesFor($target),
            'userAbilities' => [
                'manage_db' => $this->authorization->canManageClientDatabase($request->user(), $target),
                'can_access_contracts' => $target->canInvoiceAnyDbProduct(),
                'can_manage_promotions' => app(PromotionAuthorizationService::class)->canViewModule($target),
            ],
        ]);
    }

    public function update(Request $request, ?User $user = null): JsonResponse|RedirectResponse
    {
        $target = $user ?? $request->user();

        $this->authorize('update', $target);

        $rules = [
            'version' => ['required', 'integer', Rule::in([1])],
            'general' => ['required', 'array'],
            'general.theme' => ['required', Rule::in(['light', 'dark', 'system'])],
            'general.accent' => ['required', Rule::in(['brand', 'green', 'blue', 'neutral'])],
            'general.density' => ['required', Rule::in(['comfortable', 'compact'])],
            'confirmations' => ['required', 'array'],
            'confirmations.removeItem' => ['required', 'boolean'],
            'confirmations.clearCart' => ['required', 'boolean'],
            'confirmations.removeMissingImageLink' => ['required', 'boolean'],
            'confirmations.removeMissingImageLinks' => ['required', 'boolean'],
            'pages' => ['required', 'array'],
        ];

        foreach (self::PAGE_VIEWS as $page => $views) {
            $rules["pages.{$page}"] = ['required', 'array'];
            $rules["pages.{$page}.enabled"] = ['required', 'boolean'];
            $rules["pages.{$page}.view"] = ['required', Rule::in($views)];
            $rules["pages.{$page}.rightSidebarOpen"] = ['required', 'boolean'];
        }

        $rules['pages.products.autoOpenCartOnAdd'] = ['required', 'boolean'];

        $validated = $request->validate($rules);

        $target->usersMeta()->updateOrCreate(
            ['key' => UserMeta::APPEARANCE_PREFERENCES_KEY],
            [
                'title' => 'Préférences d’affichage',
                'value' => json_encode($validated, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'type' => 'json',
                'sort_order' => 0,
            ],
        );

        if ($request->expectsJson()) {
            return response()->json(['preferences' => $validated]);
        }

        return back()->with('success', 'Préférences d’affichage enregistrées');
    }
}
