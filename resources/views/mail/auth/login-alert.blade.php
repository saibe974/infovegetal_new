<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f3f5f3;font-family:Arial,sans-serif;color:#183328">
    <table role="presentation" width="100%" cellpadding="24"><tr><td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background:white" cellpadding="24"><tr><td>
            <p>{{ config('app.name') }}</p>
            <h1>{{ __('New login') }}</h1>
            <div style="line-height:1.6">
                <p>{{ __(':name just logged in.', ['name' => (string) ($loginUser['name'] ?? '')]) }}</p>
                <table role="presentation" cellpadding="4">
                    <tr>
                        <td style="color:#666">{{ __('User') }}</td>
                        <td>{{ $loginUser['name'] ?? '' }} ({{ $loginUser['email'] ?? '' }})</td>
                    </tr>
                    <tr>
                        <td style="color:#666">{{ __('Date') }}</td>
                        <td>{{ $loginAt->format('d/m/Y H:i') }}</td>
                    </tr>
                    <tr>
                        <td style="color:#666">{{ __('IP address') }}</td>
                        <td>{{ $ipAddress ?: '—' }}</td>
                    </tr>
                    <tr>
                        <td style="color:#666">{{ __('Browser') }}</td>
                        <td>{{ $userAgent ?: '—' }}</td>
                    </tr>
                </table>
            </div>
            <hr style="margin-top:32px;border:0;border-top:1px solid #ddd">
            <p style="font-size:12px;color:#666">{{ __('You receive this email because you enabled login alerts in your profile settings.') }}</p>
        </td></tr></table>
    </td></tr></table>
</body>
</html>