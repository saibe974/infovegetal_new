<?php

namespace App\Listeners;

use App\Mail\LoginAlertMail;
use App\Models\LoginLog;
use App\Models\User;
use Illuminate\Auth\Events\Login;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class RecordSuccessfulLogin
{
    private const ALERT_ROLES = ['dev', 'admin', 'commercial'];

    private const ALERT_META_KEY = 'login_alert';

    private const ALERT_THROTTLE_MINUTES = 10;

    private const USER_AGENT_MAX_LENGTH = 500;

    public function handle(Login $event): void
    {
        $user = $event->user;

        if (! $user instanceof User || ! $user->id) {
            return;
        }

        // Connexions par impersonation : ni loggées ni notifiées.
        if ($this->isImpersonation()) {
            return;
        }

        $request = request();

        $this->writeLog($user, $request);
        $this->sendAlerts($user, $request);
    }

    private function isImpersonation(): bool
    {
        if (! app()->bound('impersonate')) {
            return false;
        }

        return (bool) app('impersonate')->getImpersonatorId();
    }

    private function writeLog(User $user, ?Request $request): void
    {
        try {
            LoginLog::create([
                'user_id' => $user->id,
                'ip_address' => $request?->ip(),
                'user_agent' => $this->userAgent($request),
                'login_at' => now(),
            ]);
        } catch (Throwable $e) {
            Log::error('login_log.write_failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function sendAlerts(User $loginUser, ?Request $request): void
    {
        try {
            $recipients = User::query()
                ->whereHas('roles', fn ($query) => $query->whereIn('name', self::ALERT_ROLES))
                ->where('id', '!=', $loginUser->id)
                ->where('active', true)
                ->whereHas('usersMeta', fn ($query) => $query
                    ->where('key', self::ALERT_META_KEY)
                    ->where('value', '1'))
                ->get();

            foreach ($recipients as $recipient) {
                if (! Cache::add(
                    $this->throttleKey($recipient, $loginUser),
                    true,
                    now()->addMinutes(self::ALERT_THROTTLE_MINUTES),
                )) {
                    continue;
                }

                try {
                    Mail::to($recipient->email)->send(new LoginAlertMail(
                        loginUser: $loginUser->only(['name', 'email']),
                        ipAddress: $request?->ip(),
                        userAgent: $this->userAgent($request),
                        loginAt: now(),
                    ));
                } catch (Throwable $e) {
                    report($e);
                }
            }
        } catch (Throwable $e) {
            report($e);
        }
    }

    private function userAgent(?Request $request): ?string
    {
        $agent = $request?->userAgent();

        if (! $agent) {
            return null;
        }

        return substr($agent, 0, self::USER_AGENT_MAX_LENGTH);
    }

    private function throttleKey(User $recipient, User $loginUser): string
    {
        return 'login-alert:' . $recipient->id . ':' . $loginUser->id;
    }
}