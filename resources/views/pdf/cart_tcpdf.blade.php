<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Panier</title>
    <style>
        body { font-family: dejavusans, sans-serif; font-size: 10px; color: #222; }
        h1 { font-size: 16px; margin: 0 0 8px 0; color: #166534; }
        .meta { margin: 0 0 10px 0; }
        .meta p { margin: 1px 0; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #22c55e; color: #fff; font-size: 9px; padding: 5px; border: 1px solid #cbd5e1; }
        td { font-size: 9px; padding: 5px; border: 1px solid #e2e8f0; vertical-align: top; }
        .num { text-align: right; white-space: nowrap; }
        .totals td { font-weight: bold; }
        .section-title { font-size: 12px; margin: 12px 0 6px 0; color: #166534; }
        .small { font-size: 8px; color: #475569; }
    </style>
</head>
<body>
    <h1>Panier de commande</h1>
    <div class="meta">
        <p><strong>Date :</strong> {{ now()->format('d/m/Y H:i') }}</p>
        @if(!empty($order_number))
            <p><strong>Commande :</strong> {{ $order_number }}</p>
        @endif
        <p><strong>Client :</strong> {{ $user->name }}</p>
        <p><strong>Email :</strong> {{ $user->email }}</p>
        @if($facturant)
            <p><strong>Facturant :</strong> {{ $facturant->name }} @if($facturant->email)- {{ $facturant->email }}@endif</p>
        @endif
        @if($commercial)
            <p><strong>Commercial :</strong> {{ $commercial->name }} @if($commercial->email)- {{ $commercial->email }}@endif</p>
        @endif
    </div>

    <table>
        <thead>
            <tr>
                <th width="36%">Produit</th>
                <th width="18%">EAN</th>
                <th width="10%" class="num">Prix u.</th>
                <th width="10%" class="num">Qté</th>
                <th width="12%" class="num">Total</th>
                <th width="14%">Fournisseur</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $item)
                @php
                    $product = $item['product'];
                    $ean = preg_replace('/\D+/', '', (string) ($product->ean13 ?? ''));
                    $supplier = (string) ($product->dbProduct->name ?? '');
                @endphp
                <tr>
                    <td>{{ $product->name }}</td>
                    <td>{{ $ean !== '' ? $ean : 'N/A' }}</td>
                    <td class="num">{{ number_format((float) $item['unit_price'], 2, ',', ' ') }} EUR</td>
                    <td class="num">{{ (int) $item['quantity'] }}</td>
                    <td class="num">{{ number_format((float) $item['line_total'], 2, ',', ' ') }} EUR</td>
                    <td>{{ $supplier !== '' ? $supplier : '-' }}</td>
                </tr>
            @endforeach
            <tr class="totals">
                <td colspan="4" class="num">Total produits</td>
                <td class="num">{{ number_format((float) ($items_total ?? 0), 2, ',', ' ') }} EUR</td>
                <td></td>
            </tr>
            <tr class="totals">
                <td colspan="4" class="num">Frais de transport</td>
                <td class="num">{{ number_format((float) ($shipping_total ?? 0), 2, ',', ' ') }} EUR</td>
                <td></td>
            </tr>
            <tr class="totals">
                <td colspan="4" class="num">Total general</td>
                <td class="num">{{ number_format((float) ($total ?? 0), 2, ',', ' ') }} EUR</td>
                <td></td>
            </tr>
        </tbody>
    </table>

    @if(!empty($roll_distribution['suppliers']))
        <div class="section-title">Repartition des rolls (resume)</div>
        <table>
            <thead>
                <tr>
                    <th width="42%">Fournisseur</th>
                    <th width="18%">Pays</th>
                    <th width="12%" class="num">Mini</th>
                    <th width="14%" class="num">Rolls</th>
                    <th width="14%" class="num">Remplissage</th>
                </tr>
            </thead>
            <tbody>
                @foreach($roll_distribution['suppliers'] as $supplier)
                    <tr>
                        <td>{{ $supplier['name'] ?? '-' }}</td>
                        <td>{{ $supplier['country'] ?: '-' }}</td>
                        <td class="num">{{ (int) ($supplier['mini'] ?? 0) }}</td>
                        <td class="num">{{ (int) ($supplier['roll_count'] ?? 0) }}</td>
                        <td class="num">{{ number_format((float) ($supplier['coef_avg'] ?? 0), 1, ',', ' ') }}%</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <p class="small">Document genere le {{ now()->format('d/m/Y H:i') }} - rendu TCPDF simplifie</p>
</body>
</html>
