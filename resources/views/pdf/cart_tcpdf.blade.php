<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Panier - {{ $user->name }}</title>
    <style>
        body {
            font-family: dejavusans, sans-serif;
            font-size: 9.5px;
            color: #222;
            line-height: 1.45;
        }
        .header {
            text-align: center;
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 2px solid #22c55e;
        }
        .header h1 {
            margin: 0 0 2px;
            color: #166534;
            font-size: 18px;
            font-weight: bold;
        }
        .header p {
            margin: 1px 0;
            font-size: 9px;
            color: #374151;
        }
        .contacts-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 6px 0;
            margin-bottom: 10px;
        }
        .contact-cell {
            border: 1px solid #dbe2ea;
            border-radius: 4px;
            padding: 7px 8px;
            vertical-align: top;
            width: 50%;
        }
        .contact-label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #6b7280;
            margin-bottom: 2px;
        }
        .contact-name {
            font-size: 11px;
            font-weight: bold;
            color: #111827;
            margin-bottom: 2px;
        }
        .contact-logo {
            max-height: 24px;
            max-width: 68px;
            margin-bottom: 4px;
            display: block;
        }
        .contact-line {
            font-size: 8.5px;
            color: #374151;
            margin: 0;
        }
        .client-box {
            margin-bottom: 10px;
            padding: 7px 8px;
            background: #f7faf9;
            border-left: 3px solid #22c55e;
        }
        .client-box p {
            margin: 1px 0;
            font-size: 9px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        thead {
            display: table-header-group;
        }
        tr {
            page-break-inside: avoid;
        }
        th {
            background: #22c55e;
            color: #fff;
            font-size: 8.5px;
            padding: 5px;
            text-align: left;
            border: 1px solid #d5dde5;
            vertical-align: middle;
        }
        td {
            border: 1px solid #e5e7eb;
            font-size: 8.8px;
            padding: 5px;
            vertical-align: top;
        }
        .product-table th,
        .product-table td {
            vertical-align: middle;
        }
        .product-table th.num,
        .product-table td.num {
            text-align: right;
        }
        .num {
            text-align: right;
            white-space: nowrap;
        }
        .flag-cell {
            width: 8%;
            text-align: center;
        }
        .country-flag {
            width: 16px;
            height: 11px;
            border: 1px solid #b6bec7;
            border-radius: 2px;
            display: inline-block;
            background: #fff;
        }
        .totals-row td {
            font-weight: bold;
            background: #f8fafc;
        }
        .grand-total td {
            border-top: 2px solid #22c55e;
            font-size: 9.4px;
        }
        .thumb-cell {
            width: 11%;
            text-align: center;
        }
        .product-thumb {
            width: 34px;
            height: 34px;
            border: 1px solid #d1d5db;
            border-radius: 3px;
            object-fit: contain;
            display: inline-block;
        }
        .product-thumb-placeholder {
            width: 34px;
            height: 34px;
            border: 1px dashed #cbd5e1;
            border-radius: 3px;
            color: #64748b;
            font-size: 7px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1.1;
        }
        .section-title {
            font-size: 12px;
            margin: 12px 0 6px;
            color: #166534;
            font-weight: bold;
        }
        .supplier-block {
            margin-bottom: 8px;
            page-break-inside: avoid;
        }
        .small {
            font-size: 8px;
            color: #64748b;
            margin-top: 8px;
        }
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Panier de commande</h1>
        @if(!empty($order_number))
            <p>Commande n{{ $order_number }}</p>
        @endif
        <p>Date : {{ now()->format('d/m/Y H:i') }}</p>
    </div>

    @if($facturant || $commercial)
        <table class="contacts-table">
            <tr>
                @if($facturant)
                    <td class="contact-cell">
                        @php
                            $factLogoSrc = null;
                            $factLogoMeta = $facturant->usersMeta->firstWhere('key', 'logo');
                            if ($factLogoMeta && $factLogoMeta->value) {
                                $factLogoPath = null;
                                if (\Illuminate\Support\Facades\Storage::disk('public')->exists($factLogoMeta->value)) {
                                    $factLogoPath = \Illuminate\Support\Facades\Storage::disk('public')->path($factLogoMeta->value);
                                } elseif (\Illuminate\Support\Facades\Storage::disk('local')->exists($factLogoMeta->value)) {
                                    $factLogoPath = \Illuminate\Support\Facades\Storage::disk('local')->path($factLogoMeta->value);
                                } elseif (is_file($factLogoMeta->value)) {
                                    $factLogoPath = $factLogoMeta->value;
                                }

                                if ($factLogoPath && is_readable($factLogoPath)) {
                                    $mime = mime_content_type($factLogoPath) ?: 'image/png';
                                    $factLogoSrc = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($factLogoPath));
                                }
                            }
                        @endphp
                        <div class="contact-label">Facturant</div>
                        @if($factLogoSrc)
                            <img class="contact-logo" src="{{ $factLogoSrc }}" alt="Logo {{ $facturant->name }}">
                        @endif
                        <div class="contact-name">{{ $facturant->name }}</div>
                        @if($facturant->address_road)
                            <p class="contact-line">{{ $facturant->address_road }}</p>
                        @endif
                        @if(!empty($facturant->address_zip) || !empty($facturant->address_town))
                            <p class="contact-line">{{ trim(($facturant->address_zip ?? '') . ' ' . ($facturant->address_town ?? '')) }}</p>
                        @endif
                        @if($facturant->phone)
                            <p class="contact-line">{{ $facturant->phone }}</p>
                        @endif
                        @if($facturant->email)
                            <p class="contact-line">{{ $facturant->email }}</p>
                        @endif
                    </td>
                @else
                    <td class="contact-cell"></td>
                @endif

                @if($commercial)
                    <td class="contact-cell">
                        @php
                            $comLogoSrc = null;
                            $comLogoMeta = $commercial->usersMeta->firstWhere('key', 'logo');
                            if ($comLogoMeta && $comLogoMeta->value) {
                                $comLogoPath = null;
                                if (\Illuminate\Support\Facades\Storage::disk('public')->exists($comLogoMeta->value)) {
                                    $comLogoPath = \Illuminate\Support\Facades\Storage::disk('public')->path($comLogoMeta->value);
                                } elseif (\Illuminate\Support\Facades\Storage::disk('local')->exists($comLogoMeta->value)) {
                                    $comLogoPath = \Illuminate\Support\Facades\Storage::disk('local')->path($comLogoMeta->value);
                                } elseif (is_file($comLogoMeta->value)) {
                                    $comLogoPath = $comLogoMeta->value;
                                }

                                if ($comLogoPath && is_readable($comLogoPath)) {
                                    $mime = mime_content_type($comLogoPath) ?: 'image/png';
                                    $comLogoSrc = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($comLogoPath));
                                }
                            }
                        @endphp
                        <div class="contact-label">Commercial</div>
                        @if($comLogoSrc)
                            <img class="contact-logo" src="{{ $comLogoSrc }}" alt="Logo {{ $commercial->name }}">
                        @endif
                        <div class="contact-name">{{ $commercial->name }}</div>
                        @if($commercial->address_road)
                            <p class="contact-line">{{ $commercial->address_road }}</p>
                        @endif
                        @if(!empty($commercial->address_zip) || !empty($commercial->address_town))
                            <p class="contact-line">{{ trim(($commercial->address_zip ?? '') . ' ' . ($commercial->address_town ?? '')) }}</p>
                        @endif
                        @if($commercial->phone)
                            <p class="contact-line">{{ $commercial->phone }}</p>
                        @endif
                        @if($commercial->email)
                            <p class="contact-line">{{ $commercial->email }}</p>
                        @endif
                    </td>
                @else
                    <td class="contact-cell"></td>
                @endif
            </tr>
        </table>
    @endif

    <div class="client-box">
        <p><strong>Client :</strong> {{ $user->name }}</p>
        <p><strong>Email :</strong> {{ $user->email }}</p>
    </div>

    @php
        $buildCountryFlagDataUri = function (?string $raw): ?string {
            $cc = strtoupper(trim((string) $raw));
            if ($cc === '') {
                return null;
            }

            $w = 180;
            $h = 120;
            $svg = null;

            if ($cc === 'FR') {
                $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $w . ' ' . $h . '"><rect width="60" height="120" x="0" y="0" fill="#0055A4"/><rect width="60" height="120" x="60" y="0" fill="#FFFFFF"/><rect width="60" height="120" x="120" y="0" fill="#EF4135"/></svg>';
            } elseif ($cc === 'DE') {
                $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $w . ' ' . $h . '"><rect width="180" height="40" x="0" y="0" fill="#000000"/><rect width="180" height="40" x="0" y="40" fill="#DD0000"/><rect width="180" height="40" x="0" y="80" fill="#FFCE00"/></svg>';
            } elseif ($cc === 'ES') {
                $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $w . ' ' . $h . '"><rect width="180" height="30" x="0" y="0" fill="#AA151B"/><rect width="180" height="60" x="0" y="30" fill="#F1BF00"/><rect width="180" height="30" x="0" y="90" fill="#AA151B"/></svg>';
            } elseif ($cc === 'IT') {
                $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $w . ' ' . $h . '"><rect width="60" height="120" x="0" y="0" fill="#009246"/><rect width="60" height="120" x="60" y="0" fill="#FFFFFF"/><rect width="60" height="120" x="120" y="0" fill="#CE2B37"/></svg>';
            } elseif ($cc === 'NL') {
                $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $w . ' ' . $h . '"><rect width="180" height="40" x="0" y="0" fill="#AE1C28"/><rect width="180" height="40" x="0" y="40" fill="#FFFFFF"/><rect width="180" height="40" x="0" y="80" fill="#21468B"/></svg>';
            } elseif ($cc === 'BE') {
                $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $w . ' ' . $h . '"><rect width="60" height="120" x="0" y="0" fill="#000000"/><rect width="60" height="120" x="60" y="0" fill="#FDDA24"/><rect width="60" height="120" x="120" y="0" fill="#EF3340"/></svg>';
            } elseif ($cc === 'GB' || $cc === 'UK') {
                $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $w . ' ' . $h . '"><rect width="180" height="120" fill="#012169"/><path d="M0,0 L180,120 M180,0 L0,120" stroke="#FFFFFF" stroke-width="24"/><path d="M0,0 L180,120 M180,0 L0,120" stroke="#C8102E" stroke-width="12"/><rect x="72" width="36" height="120" fill="#FFFFFF"/><rect y="42" width="180" height="36" fill="#FFFFFF"/><rect x="78" width="24" height="120" fill="#C8102E"/><rect y="48" width="180" height="24" fill="#C8102E"/></svg>';
            }

            if (!$svg) {
                return null;
            }

            return 'data:image/svg+xml;base64,' . base64_encode($svg);
        };
    @endphp

    <table class="product-table">
        <thead>
            <tr>
                <th width="8%">Pays</th>
                <th width="11%">Image</th>
                <th width="29%">Produit</th>
                <th width="15%">EAN</th>
                <th width="10%" class="num">Prix u.</th>
                <th width="9%" class="num">Qté</th>
                <th width="18%" class="num">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $item)
                @php
                    $product = $item['product'];
                    $ean = preg_replace('/\D+/', '', (string) ($product->ean13 ?? ''));
                    $countryCode = strtoupper((string) ($product->dbProduct->country ?? ''));
                    $flagSrc = $buildCountryFlagDataUri($countryCode);
                    $thumbSrc = null;

                    $media = method_exists($product, 'getFirstMedia') ? $product->getFirstMedia('images') : null;
                    if ($media) {
                        $thumbPath = null;
                        if (method_exists($media, 'hasGeneratedConversion') && $media->hasGeneratedConversion('thumb')) {
                            $thumbPath = $media->getPath('thumb');
                        } else {
                            $thumbPath = $media->getPath();
                        }

                        if ($thumbPath && is_file($thumbPath) && is_readable($thumbPath)) {
                            $mime = mime_content_type($thumbPath) ?: 'image/jpeg';
                            $thumbSrc = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($thumbPath));
                        }
                    }
                @endphp
                <tr>
                    <td class="flag-cell">
                        @if($flagSrc)
                            <img src="{{ $flagSrc }}" alt="Pays {{ $countryCode }}" class="country-flag">
                        @else
                            -
                        @endif
                    </td>
                    <td class="thumb-cell">
                        @if($thumbSrc)
                            <img class="product-thumb" src="{{ $thumbSrc }}" alt="{{ $product->name }}">
                        @else
                            <span class="product-thumb-placeholder">N/A</span>
                        @endif
                    </td>
                    <td>{{ $product->name }}</td>
                    <td>{{ $ean !== '' ? $ean : 'N/A' }}</td>
                    <td class="num">{{ number_format((float) $item['unit_price'], 2, ',', ' ') }} EUR</td>
                    <td class="num">{{ (int) $item['quantity'] }}</td>
                    <td class="num">{{ number_format((float) $item['line_total'], 2, ',', ' ') }} EUR</td>
                </tr>
            @endforeach
            <tr class="totals-row">
                <td colspan="5" class="num">Total produits</td>
                <td class="num">{{ number_format((float) ($items_total ?? 0), 2, ',', ' ') }} EUR</td>
            </tr>
            <tr class="totals-row">
                <td colspan="5" class="num">Frais de transport</td>
                <td class="num">{{ number_format((float) ($shipping_total ?? 0), 2, ',', ' ') }} EUR</td>
            </tr>
            <tr class="totals-row grand-total">
                <td colspan="5" class="num">Total general</td>
                <td class="num">{{ number_format((float) ($total ?? 0), 2, ',', ' ') }} EUR</td>
            </tr>
        </tbody>
    </table>

    @if(!empty($roll_distribution['suppliers']))
        <div class="page-break"></div>
        <div class="section-title">Repartition des rolls</div>

        @foreach($roll_distribution['suppliers'] as $supplier)
            <div class="supplier-block">
                <table>
                    <thead>
                        <tr>
                            <th width="42%">Fournisseur</th>
                            <th width="16%">Pays</th>
                            <th width="12%" class="num">Mini</th>
                            <th width="14%" class="num">Rolls</th>
                            <th width="16%" class="num">Remplissage</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{{ $supplier['name'] ?? '-' }}</td>
                            <td>{{ $supplier['country'] ?: '-' }}</td>
                            <td class="num">{{ (int) ($supplier['mini'] ?? 0) }}</td>
                            <td class="num">{{ (int) ($supplier['roll_count'] ?? 0) }}</td>
                            <td class="num">{{ number_format((float) ($supplier['coef_avg'] ?? 0), 1, ',', ' ') }}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        @endforeach
    @endif

    <p class="small">Document genere le {{ now()->format('d/m/Y H:i') }} - rendu TCPDF</p>
</body>
</html>
