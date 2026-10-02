<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LoginAlertController extends Controller
{
    public const LOGIN_ALERT_KEY = 'login_alert';

    public const ALERT_ROLES = ['dev', 'admin', 'commercial'];

    public static function enabledFor(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        $value = $user->usersMeta()
            ->where('key', self::LOGIN_ALERT_KEY)
            ->value('value');

        return in_array($value, ['1', 1, true], true);
    }

    public static function isEligible(?User $user): bool
    {
        return $user !== null && $user->hasAnyRole(...self::ALERT_ROLES);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        abort_unless(self::isEligible($user), 403);

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $user->usersMeta()->updateOrCreate(
            ['key' => self::LOGIN_ALERT_KEY],
            [
                'title' => 'Alerte connexion',
                'value' => $validated['enabled'] ? '1' : '0',
                'type' => 'boolean',
                'sort_order' => 0,
            ],
        );

        return response()->json(['loginAlert' => (bool) $validated['enabled']]);
    }
}