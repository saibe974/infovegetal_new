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
        .contacts-header {
            display: table;
            width: 100%;
            margin-bottom: 20px;
            border-collapse: collapse;
        }
        .contact-block {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding: 10px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
        }
        .contact-block + .contact-block {
            border-left: none;
        }
        .contact-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6b7280;
            margin-bottom: 4px;
        }
        .contact-name {
            font-size: 13px;
            font-weight: bold;
            color: #111;
            margin-bottom: 2px;
        }
        .contact-detail {
            font-size: 10px;
            color: #444;
            margin: 1px 0;
        }
        .contact-logo {
            max-height: 50px;
            max-width: 120px;
            margin-bottom: 6px;
            display: block;
        }
        .product-thumb {
            width: 46px;
            height: 46px;
            border: 1px solid #ddd;
            border-radius: 4px;
            object-fit: contain;
            display: block;
            background: #fff;
        }
        .product-thumb-placeholder {
            width: 46px;
            height: 46px;
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            background: #f8fafc;
            color: #64748b;
            font-size: 8px;
            line-height: 1.2;
            text-align: center;
            display: table-cell;
            vertical-align: middle;
        }
        .ean-cell {
            min-width: 150px;
        }
        .ean-text {
            font-size: 10px;
            color: #111;
            margin-bottom: 4px;
            font-family: 'DejaVu Sans Mono', monospace;
        }
        .ean-top {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
        }
        .ean-barcode {
            width: 140px;
            height: 34px;
            display: block;
        }
        .country-flag {
            width: 18px;
            height: 12px;
            border: 1px solid #bbb;
            border-radius: 2px;
            display: inline-block;
            background: #fff;
        }
        .rolls-section {
            margin-top: 28px;
        }
        .rolls-title {
            font-size: 18px;
            color: #166534;
            margin: 0 0 14px;
        }
        .supplier-block {
            margin-bottom: 24px;
            page-break-inside: avoid;
        }
        .supplier-head {
            margin-bottom: 10px;
            padding-bottom: 6px;
            border-bottom: 1px solid #d1d5db;
        }
        .supplier-name {
            font-size: 14px;
            font-weight: bold;
            color: #111827;
        }
        .supplier-meta {
            font-size: 10px;
            color: #6b7280;
            margin-top: 2px;
        }
        .rolls-grid {
            font-size: 0;
        }
        .roll-card {
            display: inline-block;
            vertical-align: top;
            width: 158px;
            margin: 0 12px 16px 0;
            page-break-inside: avoid;
        }
        .roll-top {
            text-align: center;
            margin-bottom: 6px;
            font-size: 10px;
        }
        .roll-badge {
            display: inline-block;
            border: 1px solid #111827;
            border-radius: 999px;
            padding: 2px 8px;
            background: #fff;
            font-weight: bold;
        }
        .roll-shell {
            position: relative;
            width: 140px;
            height: 210px;
            padding: 6px;
            border: 2px solid #ac9c9c;
            border-top: 0;
            border-radius: 0 0 8px 8px;
            background: #fff;
        }
        .roll-flag {
            position: absolute;
            left: -14px;
            top: 8px;
            padding: 2px;
            border: 1px solid #111827;
            border-radius: 999px;
            background: #fff;
        }
        .roll-fill {
            position: absolute;
            right: -10px;
            top: 8px;
        }
        .roll-body {
            position: absolute;
            left: 6px;
            right: 6px;
            bottom: 6px;
            top: 12px;
            display: flex;
            flex-direction: column-reverse;
            gap: 2px;
        }
        .roll-floor {
            display: flex;
            align-items: flex-end;
            border-bottom: 1px solid #334155;
            overflow: hidden;
            justify-content: flex-start;
        }
        .roll-carton {
            border: 1px solid rgba(15, 23, 42, 0.25);
            box-sizing: border-box;
        }
        .non-roll-note {
            padding: 10px 12px;
            border: 1px dashed #cbd5e1;
            color: #64748b;
            font-size: 11px;
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
    <div class="contacts-header">
        @foreach([['contact' => $facturant, 'label' => 'Facturant'], ['contact' => $commercial, 'label' => 'Commercial']] as $entry)
            @if($entry['contact'])
            @php
                $c = $entry['contact'];
                $logo = $c->usersMeta->firstWhere('key', 'logo');
                $logoPath = null;
                if ($logo && $logo->value) {
                    if (\Illuminate\Support\Facades\Storage::disk('public')->exists($logo->value)) {
                        $logoPath = \Illuminate\Support\Facades\Storage::disk('public')->path($logo->value);
                    } elseif (\Illuminate\Support\Facades\Storage::disk('local')->exists($logo->value)) {
                        $logoPath = \Illuminate\Support\Facades\Storage::disk('local')->path($logo->value);
                    } elseif (file_exists($logo->value)) {
                        $logoPath = $logo->value;
                    }
                }
                $addrLine = trim(($c->address_zip ?? '') . ' ' . ($c->address_town ?? ''));
            @endphp
            <div class="contact-block">
                <div class="contact-label">{{ $entry['label'] }}</div>
                @if($logoPath)
                    <img class="contact-logo" src="{{ $logoPath }}" alt="Logo {{ $c->name }}">
                @endif
                <div class="contact-name">{{ $c->name }}</div>
                @if($c->address_road)
                    <div class="contact-detail">{{ $c->address_road }}</div>
                @endif
                @if($addrLine)
                    <div class="contact-detail">{{ $addrLine }}</div>
                @endif
                @if($c->phone)
                    <div class="contact-detail">{{ $c->phone }}</div>
                @endif
                @if($c->email)
                    <div class="contact-detail">{{ $c->email }}</div>
                @endif
            </div>
            @endif
        @endforeach
    </div>
    @endif

    <div class="user-info">
        <p><strong>Client :</strong> {{ $user->name }}</p>
        <p><strong>Email :</strong> {{ $user->email }}</p>
    </div>

    @php
        $buildEan13DataUri = function (?string $raw): ?string {
            $digits = preg_replace('/\D+/', '', (string) $raw);
            if (strlen($digits) !== 13) {
                return null;
            }

            $setA = [
                '0' => '0001101', '1' => '0011001', '2' => '0010011', '3' => '0111101', '4' => '0100011',
                '5' => '0110001', '6' => '0101111', '7' => '0111011', '8' => '0110111', '9' => '0001011',
            ];
            $setB = [
                '0' => '0100111', '1' => '0110011', '2' => '0011011', '3' => '0100001', '4' => '0011101',
                '5' => '0111001', '6' => '0000101', '7' => '0010001', '8' => '0001001', '9' => '0010111',
            ];
            $setC = [
                '0' => '1110010', '1' => '1100110', '2' => '1101100', '3' => '1000010', '4' => '1011100',
                '5' => '1001110', '6' => '1010000', '7' => '1000100', '8' => '1001000', '9' => '1110100',
            ];

            $parity = [
                '0' => 'AAAAAA', '1' => 'AABABB', '2' => 'AABBAB', '3' => 'AABBBA', '4' => 'ABAABB',
                '5' => 'ABBAAB', '6' => 'ABBBAA', '7' => 'ABABAB', '8' => 'ABABBA', '9' => 'ABBABA',
            ];

            $first = $digits[0];
            $left = substr($digits, 1, 6);
            $right = substr($digits, 7, 6);

            $pattern = '101';
            for ($i = 0; $i < 6; $i++) {
                $d = $left[$i];
                $pattern .= ($parity[$first][$i] === 'A') ? $setA[$d] : $setB[$d];
            }
            $pattern .= '01010';
            for ($i = 0; $i < 6; $i++) {
                $pattern .= $setC[$right[$i]];
            }
            $pattern .= '101';

            $moduleW = 1;
            $quiet = 10;
            $barH = 34;
            $totalW = (strlen($pattern) + 2 * $quiet) * $moduleW;

            $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' . $totalW . '" height="' . $barH . '" viewBox="0 0 ' . $totalW . ' ' . $barH . '">';
            $svg .= '<rect width="100%" height="100%" fill="#fff"/>';

            for ($i = 0; $i < strlen($pattern); $i++) {
                if ($pattern[$i] === '1') {
                    $x = ($quiet + $i) * $moduleW;
                    $svg .= '<rect x="' . $x . '" y="0" width="' . $moduleW . '" height="' . $barH . '" fill="#000"/>';
                }
            }

            $svg .= '</svg>';
            return 'data:image/svg+xml;base64,' . base64_encode($svg);
        };

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

        $getColorForId = function (int $id): string {
            $hue = ($id * 47) % 360;
            return 'hsl(' . $hue . ' 60% 60%)';
        };

        $productMap = collect($items)->mapWithKeys(fn ($item) => [$item['product']->id => $item['product']]);
    @endphp

    <table>
        <thead>
            <tr>
                <th>Image</th>
                <th>EAN / Code-barres</th>
                <th>Produit</th>
                <th class="text-right">Prix unitaire</th>
                <th class="text-right">Quantité</th>
                <th class="text-right">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $item)
            @php
                $product = $item['product'];
                $thumbSrc = null;
                $ean = preg_replace('/\D+/', '', (string) ($product->ean13 ?? ''));
                $eanDisplay = $ean !== '' ? $ean : 'N/A';
                $barcodeSrc = $buildEan13DataUri($ean);
                $countryCode = strtoupper((string) ($product->dbProduct->country ?? ''));
                $flagSrc = $buildCountryFlagDataUri($countryCode);

                $media = method_exists($product, 'getFirstMedia') ? $product->getFirstMedia('images') : null;
                if ($media) {
                    $path = null;
                    if (method_exists($media, 'hasGeneratedConversion') && $media->hasGeneratedConversion('thumb')) {
                        $path = $media->getPath('thumb');
                    } else {
                        $path = $media->getPath();
                    }

                    if ($path && is_file($path) && is_readable($path)) {
                        $mime = mime_content_type($path) ?: 'image/jpeg';
                        $thumbSrc = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($path));
                    }
                }
            @endphp
            <tr>
                <td>
                    @if($thumbSrc)
                        <img src="{{ $thumbSrc }}" alt="{{ $product->name }}" class="product-thumb">
                    @else
                        <div class="product-thumb-placeholder">Image<br>indisponible</div>
                    @endif
                </td>
                <td class="ean-cell">
                    <div class="ean-top">
                        <div class="ean-text">{{ $eanDisplay }}</div>
                        @if($flagSrc)
                            <img src="{{ $flagSrc }}" alt="Pays {{ $countryCode }}" class="country-flag">
                        @endif
                    </div>
                    @if($barcodeSrc)
                        <img src="{{ $barcodeSrc }}" alt="Code-barres {{ $eanDisplay }}" class="ean-barcode">
                    @endif
                </td>
                <td>{{ $product->name }}</td>
                <td class="text-right">{{ number_format($item['unit_price'], 2, ',', ' ') }} €</td>
                <td class="text-right">{{ $item['quantity'] }}</td>
                <td class="text-right">{{ number_format($item['line_total'], 2, ',', ' ') }} €</td>
            </tr>
            @endforeach
            <tr>
                <td colspan="5" class="text-right">Total produits :</td>
                <td class="text-right">{{ number_format($items_total ?? 0, 2, ',', ' ') }} €</td>
            </tr>
            <tr>
                <td colspan="5" class="text-right">Frais de transport :</td>
                <td class="text-right">{{ number_format($shipping_total ?? 0, 2, ',', ' ') }} €</td>
            </tr>
            <tr class="total-row">
                <td colspan="5" class="text-right">Total général :</td>
                <td class="text-right">{{ number_format($total, 2, ',', ' ') }} €</td>
            </tr>
        </tbody>
    </table>

    @if(!empty($roll_distribution['suppliers']))
    <div class="rolls-section">
        <h2 class="rolls-title">Répartition des rolls</h2>
        @foreach($roll_distribution['suppliers'] as $supplier)
            <div class="supplier-block">
                <div class="supplier-head">
                    <div class="supplier-name">{{ $supplier['name'] }}</div>
                    <div class="supplier-meta">
                        {{ $supplier['country'] ?: 'unknown' }} · {{ $supplier['mod_liv'] ?: 'roll' }}
                        @if(($supplier['mini'] ?? 0) > 0)
                            · min {{ $supplier['mini'] }}
                        @endif
                        · {{ $supplier['roll_count'] }} roll(s)
                        · remplissage moyen {{ number_format((float) ($supplier['coef_avg'] ?? 0), 1, ',', ' ') }}%
                    </div>
                </div>

                @if(($supplier['mod_liv'] ?? 'roll') !== 'roll')
                    <div class="non-roll-note">Ce fournisseur n'est pas configure pour une livraison en roll.</div>
                @elseif(empty($supplier['rolls']))
                    <div class="non-roll-note">Aucun roll a dessiner pour ce fournisseur.</div>
                @else
                    <div class="rolls-grid">
                        @foreach($supplier['rolls'] as $rollIndex => $roll)
                            @php
                                $flagSrc = $buildCountryFlagDataUri((string) ($supplier['country'] ?? ''));
                                $rollReferenceHeight = 100.0;
                            @endphp
                            <div class="roll-card">
                                <div class="roll-top">
                                    <span class="roll-badge">Roll {{ $rollIndex + 1 }}</span>
                                </div>
                                <div class="roll-shell">
                                    @if($flagSrc)
                                        <span class="roll-flag"><img src="{{ $flagSrc }}" alt="Pays {{ $supplier['country'] }}" class="country-flag"></span>
                                    @endif
                                    <span class="roll-fill"><span class="roll-badge">{{ number_format((float) ($roll['coef'] ?? 0), 1, ',', ' ') }}%</span></span>
                                    <div class="roll-body">
                                        @foreach($roll['etages'] as $etage)
                                            @php
                                                $heightRatio = max(0, min(1, (float) ($etage['y'] ?? 0) / $rollReferenceHeight));
                                                $floorHeight = max(8, (int) floor(180 * $heightRatio));
                                                $cartons = $etage['cartons'] ?? collect($etage['items'] ?? [])->map(fn ($productId) => ['product_id' => $productId, 'x' => 100 / max(1, count($etage['items'] ?? []))])->all();
                                            @endphp
                                            <div class="roll-floor" style="height: {{ $floorHeight }}px;">
                                                @foreach($cartons as $carton)
                                                    @php
                                                        $productId = (int) ($carton['product_id'] ?? 0);
                                                        $product = $productMap->get($productId);
                                                        $name = $product?->name ?? ('Produit ' . $productId);
                                                        $widthPercent = max(1, (float) ($carton['x'] ?? 0));
                                                        $cartonY = max(0.1, (float) ($carton['y'] ?? ($etage['y'] ?? 1)));
                                                        $etageY = max(0.1, (float) ($etage['y'] ?? $cartonY));
                                                        $cartonHeight = max(8, (int) floor($floorHeight * min(1, $cartonY / $etageY)));
                                                    @endphp
                                                    <div
                                                        class="roll-carton"
                                                        title="{{ $name }}"
                                                        style="width: {{ $widthPercent }}%; height: {{ $cartonHeight }}px; background: {{ $getColorForId((int) $productId) }};"
                                                    ></div>
                                                @endforeach
                                            </div>
                                        @endforeach
                                    </div>
                                </div>
                            </div>
                        @endforeach
                    </div>
                @endif
            </div>
        @endforeach
    </div>
    @endif

    <div class="footer">
        <p>Document généré le {{ now()->format('d/m/Y à H:i') }}</p>
        <p>Infovegetal - Tous droits réservés</p>
    </div>
</body>
</html>
