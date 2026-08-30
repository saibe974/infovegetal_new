<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Désinscription des mailings</title></head>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:64px auto;padding:24px;line-height:1.6">
    <h1>Désinscription des mailings</h1>
    @if($done)
        <p>Votre désinscription est enregistrée. Vous ne recevrez plus de mailings promotionnels.</p>
    @else
        <p>Confirmez votre désinscription de tous les mailings promotionnels. Les messages concernant vos commandes ne sont pas concernés.</p>
        <form method="post" action="{{ $action }}">@csrf<button type="submit" style="padding:12px 20px">Confirmer ma désinscription</button></form>
    @endif
</body>
</html>
