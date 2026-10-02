{{ __('New login') }} — {{ config('app.name') }}

{{ __(':name just logged in.', ['name' => (string) ($loginUser['name'] ?? '')]) }}

{{ __('User') }} : {{ $loginUser['name'] ?? '' }} ({{ $loginUser['email'] ?? '' }})
{{ __('Date') }} : {{ $loginAt->format('d/m/Y H:i') }}
{{ __('IP address') }} : {{ $ipAddress ?: '—' }}
{{ __('Browser') }} : {{ $userAgent ?: '—' }}

{{ __('You receive this email because you enabled login alerts in your profile settings.') }}