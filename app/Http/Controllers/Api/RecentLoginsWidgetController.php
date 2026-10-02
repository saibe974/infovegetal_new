<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoginLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecentLoginsWidgetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $logs = LoginLog::query()
            ->with('user:id,name,email')
            ->orderByDesc('login_at')
            ->orderByDesc('id')
            ->limit(10)
            ->get();

        return response()->json([
            'items' => $logs->map(fn (LoginLog $log) => [
                'id' => $log->id,
                'login_at' => $log->login_at?->toISOString(),
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
                'user' => $log->user ? [
                    'id' => $log->user->id,
                    'name' => $log->user->name,
                    'email' => $log->user->email,
                ] : null,
            ])->all(),
            'total' => $logs->count(),
        ]);
    }
}