@php($title = ['delivery' => 'Bon de livraison', 'invoice' => 'Facture', 'credit' => 'Avoir'][$document->kind])
<h1>{{ $title }} {{ $document->number }}</h1>
<p>Date : {{ $document->issued_at->format('d/m/Y') }} — Commande : {{ $snapshot['order_number'] }}</p>
@if($snapshot['invoice_number'])<p>Facture d’origine : {{ $snapshot['invoice_number'] }}</p>@endif
<h3>{{ $snapshot['issuer']['name'] }}</h3>
<p>{{ $snapshot['issuer']['address_road'] }}<br>{{ $snapshot['issuer']['address_zip'] }} {{ $snapshot['issuer']['address_town'] }}</p>
<h3>Client : {{ $snapshot['client']['name'] }} — {{ $snapshot['client']['ref'] }}</h3>
<p>{{ $snapshot['client']['address_road'] }}<br>{{ $snapshot['client']['address_zip'] }} {{ $snapshot['client']['address_town'] }}</p>
<table cellpadding="5" border="1">
    <thead><tr><th>Référence</th><th>Produit</th><th>Quantité</th>@if($document->kind !== 'delivery')<th>PU HT</th><th>TVA %</th><th>Total HT</th>@endif</tr></thead>
    <tbody>
    @foreach($snapshot['lines'] as $line)
        <tr><td>{{ $line['ref'] }}</td><td>{{ $line['name'] }}</td><td>{{ $line['quantity'] }}</td>
        @if($document->kind !== 'delivery')<td>{{ number_format($line['unit_price'], 4, ',', ' ') }}</td><td>{{ $line['tva_rate'] }}</td><td>{{ number_format($line['total_ht'], 2, ',', ' ') }} €</td>@endif</tr>
        @if($line['client_comment'])<tr><td colspan="{{ $document->kind === 'delivery' ? 3 : 6 }}">Commentaire client : {{ $line['client_comment'] }}</td></tr>@endif
    @endforeach
    </tbody>
</table>
@if($document->kind !== 'delivery')
<p>Transport et remises inclus dans les totaux de lignes.</p>
<p>Total HT : {{ number_format($snapshot['total_ht'], 2, ',', ' ') }} €<br>TVA : {{ number_format($snapshot['total_tva'], 2, ',', ' ') }} €<br><b>Total TTC : {{ number_format($snapshot['total_ttc'], 2, ',', ' ') }} €</b></p>
@endif
@if(count($snapshot['issues']) > 0)
<h3>Écarts validés à cette date</h3>
@foreach($snapshot['issues'] as $issue)
<p>Produit {{ $issue['product_id'] }} : {{ $issue['quantity'] }} {{ $issue['kind'] === 'missing' ? 'manquant(s)' : 'abîmé(s)' }} — {{ $issue['comment'] }}<br>Validation par {{ $issue['reviewer']['name'] }} : {{ $issue['resolution'] }}</p>
@endforeach
@endif
@if($snapshot['client_comment'])<p>Commentaire client : {{ $snapshot['client_comment'] }}</p>@endif
@foreach($snapshot['comments'] as $comment)
<p>{{ $comment['user']['name'] }} ({{ $comment['author_role'] }}) — {{ $comment['created_at'] }}@if($comment['product_id']) — Produit {{ $comment['product_id'] }}@endif : {{ $comment['body'] }}</p>
@endforeach
