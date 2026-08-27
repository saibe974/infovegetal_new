<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserMeta;
use App\Services\UserManagementAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AppearanceController extends Controller
{
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
            ],
        ]);
    }

    public function update(Request $request, ?User $user = null): JsonResponse|RedirectResponse
    {
        $target = $user ?? $request->user();

        $this->authorize('update', $target);

        $validated = $request->validate([
            'version' => ['required', 'integer', Rule::in([1])],
            'general' => ['required', 'array'],
            'general.theme' => ['required', Rule::in(['light', 'dark', 'system'])],
            'general.accent' => ['required', Rule::in(['brand', 'green', 'blue', 'neutral'])],
            'general.density' => ['required', Rule::in(['comfortable', 'compact'])],
            'confirmations' => ['required', 'array'],
            'confirmations.removeItem' => ['required', 'boolean'],
            'confirmations.clearCart' => ['required', 'boolean'],
            'pages' => ['required', 'array'],
            'pages.products' => ['required', 'array'],
            'pages.products.enabled' => ['required', 'boolean'],
            'pages.products.view' => ['required', Rule::in(['table', 'list', 'grid'])],
            'pages.products.rightSidebarOpen' => ['required', 'boolean'],
            'pages.products.autoOpenCartOnAdd' => ['required', 'boolean'],
            'pages.users' => ['required', 'array'],
            'pages.users.enabled' => ['required', 'boolean'],
            'pages.users.view' => ['required', Rule::in(['accordion', 'grid'])],
            'pages.users.rightSidebarOpen' => ['required', 'boolean'],
        ]);

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
