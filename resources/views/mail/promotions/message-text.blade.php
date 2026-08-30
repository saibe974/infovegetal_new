{{ $mailing->heading ?: $mailing->subject }}

{{ $mailing->body }}

@if($mailing->cta_url)
{{ $mailing->cta_label }} : {{ $mailing->cta_url }}
@endif

Se désinscrire des mailings : {{ $unsubscribeUrl }}
