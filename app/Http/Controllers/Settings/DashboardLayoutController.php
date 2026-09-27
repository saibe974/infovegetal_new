<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserMeta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardLayoutController extends Controller
{
    public const LAYOUT_KEY = 'dashboard_layout';

    private const MAX_WIDGETS = 24;

    public static function layoutFor(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        $value = $user->usersMeta()
            ->where('key', self::LAYOUT_KEY)
            ->value('value');

        if (! is_string($value)) {
            return null;
        }

        $layout = json_decode($value, true);

        return is_array($layout) ? $layout : null;
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'layout' => self::layoutFor($request->user()),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'widgets' => ['required', 'array', 'max:' . self::MAX_WIDGETS],
            'widgets.*.id' => ['required', 'string', 'max:64'],
            'widgets.*.type' => ['required', 'string', 'max:64'],
            'widgets.*.title' => ['required', 'string', 'max:255'],
            'widgets.*.x' => ['required', 'integer', 'min:0'],
            'widgets.*.y' => ['required', 'integer', 'min:0'],
            'widgets.*.w' => ['required', 'integer', 'min:1', 'max:12'],
            'widgets.*.h' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        /** @var \App\Models\User $user */
        $user = $request->user();

        $payload = json_encode(
            array_values($validated['widgets']),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        $user->usersMeta()->updateOrCreate(
            ['key' => self::LAYOUT_KEY],
            [
                'title' => 'Dashboard',
                'value' => $payload,
                'type' => 'json',
                'sort_order' => 0,
            ],
        );

        return response()->json(['layout' => $validated['widgets']]);
    }
}
