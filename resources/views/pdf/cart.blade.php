<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panier - {{ $user->name }}</title>
    <style>
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 12px;
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #22c55e;
        }
        .header h1 {
            color: #22c55e;
            margin: 0;
            font-size: 24px;
        }
        .user-info {
            margin-bottom: 20px;
            padding: 10px;
            background-color: #f9f9f9;
            border-left: 4px solid #22c55e;
        }
        .user-info p {
            margin: 5px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th {
            background-color: #22c55e;
            color: white;
            padding: 10px;
            text-align: left;
            font-weight: bold;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .text-right {
            text-align: right;
        }
        .total-row {
            font-weight: bold;
            font-size: 14px;
            background-color: #f0f0f0 !important;
        }
        .total-row td {
            padding: 15px 10px;
            border-top: 2px solid #22c55e;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 10px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Panier de commande</h1>
        <p>Date : {{ now()->format('d/m/Y H:i') }}</p>
    </div>

    <div class="user-info">
        <p><strong>Client :</strong> {{ $user->name }}</p>
        <p><strong>Email :</strong> {{ $user->email }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>SKU</th>
                <th>Produit</th>
                <th class="text-right">Prix unitaire</th>
                <th class="text-right">Quantité</th>
                <th class="text-right">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $item)
            <tr>
                <td>{{ $item['product']->sku ?? 'N/A' }}</td>
                <td>{{ $item['product']->name }}</td>
                <td class="text-right">{{ number_format($item['product']->price, 2, ',', ' ') }} €</td>
                <td class="text-right">{{ $item['quantity'] }}</td>
                <td class="text-right">{{ number_format($item['product']->price * $item['quantity'], 2, ',', ' ') }} €</td>
            </tr>
            @endforeach
            <tr class="total-row">
                <td colspan="4" class="text-right">Total général :</td>
                <td class="text-right">{{ number_format($total, 2, ',', ' ') }} €</td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        <p>Document généré le {{ now()->format('d/m/Y à H:i') }}</p>
        <p>Infovegetal - Tous droits réservés</p>
    </div>
</body>
</html>
