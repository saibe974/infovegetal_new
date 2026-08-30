<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f3f5f3;font-family:Arial,sans-serif;color:#183328">
    @if($mailing->preheader)<div style="display:none;max-height:0;overflow:hidden">{{ $mailing->preheader }}</div>@endif
    <table role="presentation" width="100%" cellpadding="24"><tr><td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background:white" cellpadding="24"><tr><td>
            <p>{{ config('app.name') }}</p>
            <h1>{{ $mailing->heading ?: $mailing->subject }}</h1>
            <div style="line-height:1.6">{!! nl2br(e($mailing->body)) !!}</div>
            @if($mailing->cta_url)<p style="margin-top:28px"><a href="{{ $mailing->cta_url }}" style="display:inline-block;background:#245b40;color:white;padding:12px 20px;text-decoration:none;border-radius:6px">{{ $mailing->cta_label }}</a></p>@endif
            <hr style="margin-top:32px;border:0;border-top:1px solid #ddd">
            <p style="font-size:12px;color:#666">Vous recevez ce message car vous avez accepté les mailings.<br><a href="{{ $unsubscribeUrl }}">Se désinscrire des mailings</a></p>
        </td></tr></table>
    </td></tr></table>
</body>
</html>
