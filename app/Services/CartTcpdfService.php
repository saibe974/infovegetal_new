<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

class CartTcpdfService
{
    public function render(array $payload): string
    {
        $pdf = app('tcpdf');
        $pdf->reset();

        try {
            $this->buildDocument($pdf, $payload);

            return (string) $pdf->Output('', 'S');
        } finally {
            $pdf->reset();
        }
    }

    public function download(array $payload, string $filename)
    {
        $binary = $this->render($payload);

        return response($binary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    private function buildDocument($pdf, array $payload): void
    {
        $pdf->SetCreator((string) config('app.name', 'Laravel'));
        $pdf->SetAuthor((string) config('app.name', 'Laravel'));
        $pdf->SetTitle('Panier de commande');
        $pdf->SetSubject('Commande client');
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(true);
        $pdf->SetMargins(8, 8, 8);
        $pdf->SetFooterMargin(7);
        $pdf->setFooterCallback(function ($pdf) {
            $pdf->SetY(-9);
            $pdf->SetDrawColor(213, 221, 229);
            $pdf->SetLineWidth(0.2);
            $pdf->Line(8, $pdf->GetY() - 0.8, 202, $pdf->GetY() - 0.8);

            $pdf->SetFont('dejavusans', '', 7.4);
            $pdf->SetTextColor(100, 116, 139);
            $pdf->Cell(0, 4, 'Page ' . $pdf->getAliasNumPage() . '/' . $pdf->getAliasNbPages(), 0, 0, 'R');
        });
        $pdf->SetAutoPageBreak(true, 16);
        $pdf->SetImageScale(1.25);
        $pdf->SetFont('dejavusans', '', 9);
        $pdf->AddPage('P', 'A4');

        $y = 8.0;
        $y = $this->renderTopHeader($pdf, $payload, $y);
        $y = $this->renderContacts($pdf, $payload, $y + 2.0);
        $y = $this->renderClientBox($pdf, $payload, $y + 2.0);
        $y = $this->renderProductsTable($pdf, $payload, $y + 3.0);
        $this->renderRollSummary($pdf, $payload, $y + 4.0);
    }

    private function renderTopHeader($pdf, array $payload, float $y): float
    {
        $left = 8.0;
        $width = 194.0;

        $pdf->SetDrawColor(34, 197, 94);
        $pdf->SetLineWidth(0.5);
        $pdf->Line($left, $y + 16, $left + $width, $y + 16);

        $pdf->SetTextColor(22, 101, 52);
        $pdf->SetFont('dejavusans', 'B', 16);
        $pdf->SetXY($left, $y);
        $pdf->Cell($width, 7, 'Panier de commande', 0, 1, 'C');

        $pdf->SetTextColor(55, 65, 81);
        $pdf->SetFont('dejavusans', '', 8.5);
        if (!empty($payload['order_number'])) {
            $pdf->SetX($left);
            $pdf->Cell($width, 4, 'Commande n' . (string) $payload['order_number'], 0, 1, 'C');
        }

        $pdf->SetX($left);
        $pdf->Cell($width, 4, 'Date : ' . now()->format('d/m/Y H:i'), 0, 1, 'C');

        return $y + 18.0;
    }

    private function renderContacts($pdf, array $payload, float $y): float
    {
        $facturant = $payload['facturant'] ?? null;
        $commercial = $payload['commercial'] ?? null;

        if (!$facturant && !$commercial) {
            return $y;
        }

        $left = 8.0;
        $gap = 4.0;
        $colW = (194.0 - $gap) / 2;
        $boxH = 34.0;

        $this->drawContactBox($pdf, $left, $y, $colW, $boxH, 'Facturant', $facturant);
        $this->drawContactBox($pdf, $left + $colW + $gap, $y, $colW, $boxH, 'Commercial', $commercial);

        return $y + $boxH;
    }

    private function drawContactBox($pdf, float $x, float $y, float $w, float $h, string $label, $contact): void
    {
        $pdf->SetDrawColor(219, 226, 234);
        $pdf->SetLineWidth(0.2);
        $pdf->Rect($x, $y, $w, $h);

        if (!$contact) {
            return;
        }

        $pdf->SetFont('dejavusans', '', 7.5);
        $pdf->SetTextColor(107, 114, 128);
        $pdf->SetXY($x + 2, $y + 1.5);
        $pdf->Cell($w - 4, 3.5, strtoupper($label), 0, 1, 'L');

        $logoPath = $this->resolveUserLogoPath($contact);
        $textX = $x + 2;
        if ($logoPath) {
            $pdf->Image($logoPath, $x + 2, $y + 6, 18, 8.5, '', '', '', true, 150, '', false, false, 0, false, false, false);
            $textX = $x + 22;
        }

        $pdf->SetFont('dejavusans', 'B', 9.2);
        $pdf->SetTextColor(17, 24, 39);
        $pdf->SetXY($textX, $y + 6);
        $pdf->Cell($w - ($textX - $x) - 2, 4.2, (string) ($contact->name ?? ''), 0, 1, 'L');

        $pdf->SetFont('dejavusans', '', 8);
        $pdf->SetTextColor(55, 65, 81);
        $lines = [];
        if (!empty($contact->address_road)) {
            $lines[] = (string) $contact->address_road;
        }
        $zipTown = trim((string) ($contact->address_zip ?? '') . ' ' . (string) ($contact->address_town ?? ''));
        if ($zipTown !== '') {
            $lines[] = $zipTown;
        }
        if (!empty($contact->phone)) {
            $lines[] = (string) $contact->phone;
        }
        if (!empty($contact->email)) {
            $lines[] = (string) $contact->email;
        }

        $lineY = $y + 11;
        foreach (array_slice($lines, 0, 4) as $line) {
            $pdf->SetXY($textX, $lineY);
            $pdf->Cell($w - ($textX - $x) - 2, 3.8, $this->truncateText($line, 48), 0, 1, 'L');
            $lineY += 3.8;
        }
    }

    private function renderClientBox($pdf, array $payload, float $y): float
    {
        $user = $payload['user'];
        $x = 8.0;
        $w = 194.0;
        $h = 13.0;

        $pdf->SetFillColor(247, 250, 249);
        $pdf->SetDrawColor(34, 197, 94);
        $pdf->Rect($x, $y, $w, $h, 'DF');

        $pdf->SetFont('dejavusans', 'B', 8.5);
        $pdf->SetTextColor(17, 24, 39);
        $pdf->SetXY($x + 2, $y + 2.2);
        $pdf->Cell($w - 4, 4, 'Client : ' . (string) ($user->name ?? ''), 0, 1, 'L');

        $pdf->SetFont('dejavusans', '', 8.5);
        $pdf->SetXY($x + 2, $y + 6.8);
        $pdf->Cell($w - 4, 4, 'Email : ' . (string) ($user->email ?? ''), 0, 1, 'L');

        return $y + $h;
    }

    private function renderProductsTable($pdf, array $payload, float $y): float
    {
        $x = 8.0;
        $cols = [10.0, 16.0, 76.0, 34.0, 20.0, 12.0, 26.0];
        $header = ['Pays', 'Image', 'Produit', 'EAN13', 'Prix u.', 'Qte', 'Total'];

        $y = $this->drawProductsHeader($pdf, $x, $y, $cols, $header);
        $rowH = 24.0;
        $bottom = $pdf->getPageHeight() - 16.0;
        $barcodeStyle = [
            'position' => '',
            'align' => 'C',
            'stretch' => false,
            'fitwidth' => true,
            'cellfitalign' => '',
            'border' => false,
            'hpadding' => 0,
            'vpadding' => 0,
            'fgcolor' => [31, 41, 55],
            'bgcolor' => false,
            'text' => false,
            'fontsize' => 6,
            'stretchtext' => 4,
        ];

        $i = 0;
        foreach (($payload['items'] ?? []) as $item) {
            if ($y + $rowH > $bottom) {
                $pdf->AddPage('P', 'A4');
                $y = 10.0;
                $y = $this->drawProductsHeader($pdf, $x, $y, $cols, $header);
            }

            $fill = ($i % 2 === 0) ? [255, 255, 255] : [249, 250, 251];
            $pdf->SetFillColor($fill[0], $fill[1], $fill[2]);
            $pdf->SetDrawColor(229, 231, 235);
            $pdf->SetTextColor(17, 24, 39);
            $pdf->SetFont('dejavusans', '', 8.3);

            $product = $item['product'];
            $country = strtoupper((string) ($product->dbProduct->country ?? ''));
            $eanRaw = preg_replace('/\D+/', '', (string) ($product->ean13 ?? ''));
            $eanBarcode = $this->normalizeEan13($eanRaw);
            $eanLabel = $eanBarcode ?: 'N/A';
            $name = $this->truncateText((string) ($product->name ?? ''), 50);
            $potHeight = $this->buildPotHeightLine($product);
            $description = trim((string) ($product->description ?? ''));
            $showDescription = $description !== '' && mb_strlen($description) <= 180;

            $cx = $x;
            foreach ($cols as $cw) {
                $pdf->Rect($cx, $y, $cw, $rowH, 'DF');
                $cx += $cw;
            }

            $this->drawCountryFlag($pdf, $x + 1.3, $y + 5.2, 7.2, 4.9, $country);

            $thumbPath = $this->resolveProductThumbPath($product);
            if ($thumbPath) {
                $pdf->Image($thumbPath, $x + $cols[0] + 1.5, $y + 1.5, $cols[1] - 3, $rowH - 3, '', '', '', true, 120, '', false, false, 0, false, false, false);
            } else {
                $pdf->SetTextColor(100, 116, 139);
                $pdf->SetXY($x + $cols[0], $y + 5.3);
                $pdf->Cell($cols[1], 4.5, 'N/A', 0, 0, 'C');
                $pdf->SetTextColor(17, 24, 39);
            }

            $tx = $x + $cols[0] + $cols[1];
            $pdf->SetXY($tx + 1.0, $y + 2.4);
            $pdf->SetFont('dejavusans', 'B', 8.2);
            $pdf->Cell($cols[2] - 2, 3.8, $name, 0, 0, 'L');

            $ref = trim((string) ($product->reference ?? $product->ref ?? ''));
            if ($ref !== '') {
                $pdf->SetFont('dejavusans', '', 7.4);
                $pdf->SetTextColor(75, 85, 99);
                $pdf->SetXY($tx + 1.0, $y + 6.2);
                $pdf->Cell($cols[2] - 2, 3.4, 'Ref: ' . $this->truncateText($ref, 22), 0, 0, 'L');
            }

            if ($potHeight !== null) {
                $pdf->SetFont('dejavusans', '', 7.2);
                $pdf->SetTextColor(75, 85, 99);
                $pdf->SetXY($tx + 1.0, $y + 9.6);
                $pdf->Cell($cols[2] - 2, 3.3, $potHeight, 0, 0, 'L');
            }

            if ($showDescription) {
                $pdf->SetFont('dejavusans', '', 7.0);
                $pdf->SetTextColor(100, 116, 139);
                $pdf->SetXY($tx + 1.0, $y + 13.0);
                $pdf->Cell($cols[2] - 2, 3.2, $this->truncateText($description, 70), 0, 0, 'L');
            }
            $pdf->SetTextColor(17, 24, 39);

            $pdf->SetFont('dejavusans', '', 8.2);
            $tx += $cols[2];
            if ($eanBarcode) {
                $pdf->write1DBarcode($eanBarcode, 'EAN13', $tx + 1.2, $y + 1.4, $cols[3] - 2.4, 8.4, 0.28, $barcodeStyle, 'N');
            }
            $pdf->SetFont('dejavusans', '', 7.4);
            $pdf->SetXY($tx, $y + 10.6);
            $pdf->Cell($cols[3], 4.0, $eanLabel, 0, 0, 'C');

            $tx += $cols[3];
            $unitPrice = (float) ($item['unit_price'] ?? 0.0);
            $quantity = (int) ($item['quantity'] ?? 0);
            $lineTotal = (float) ($item['line_total'] ?? 0.0);

            $pdf->SetTextColor(17, 24, 39);
            $pdf->SetFont('dejavusans', '', 8.1);
            $pdf->SetXY($tx + 0.6, $y + 9.2);
            $pdf->Cell($cols[4] - 1.2, 4.0, $this->eur($unitPrice), 0, 0, 'R');

            $tx += $cols[4];
            $pdf->SetTextColor(17, 24, 39);
            $pdf->SetFont('dejavusans', '', 8.1);
            $pdf->SetXY($tx + 0.6, $y + 9.2);
            $pdf->Cell($cols[5] - 1.2, 4.0, (string) $quantity, 0, 0, 'R');

            $tx += $cols[5];
            $pdf->SetFont('dejavusans', 'B', 8.6);
            $pdf->SetXY($tx + 0.6, $y + 9.0);
            $pdf->Cell($cols[6] - 1.2, 4.2, $this->eur($lineTotal), 0, 0, 'R');

            $y += $rowH;
            $i++;
        }

        $labelW = array_sum(array_slice($cols, 0, 4));
        $totalW = array_sum(array_slice($cols, 4, 3));
        $y = $this->drawTotalRow($pdf, $x, $y, $labelW, $totalW, 'Total produits', (float) ($payload['items_total'] ?? 0.0), false);
        $y = $this->drawTotalRow($pdf, $x, $y, $labelW, $totalW, 'Frais de transport', (float) ($payload['shipping_total'] ?? 0.0), false);
        $y = $this->drawTotalRow($pdf, $x, $y, $labelW, $totalW, 'Total general', (float) ($payload['total'] ?? 0.0), true);

        return $y;
    }

    private function drawProductsHeader($pdf, float $x, float $y, array $cols, array $labels): float
    {
        $pdf->SetFillColor(34, 197, 94);
        $pdf->SetTextColor(255, 255, 255);
        $pdf->SetDrawColor(213, 221, 229);
        $pdf->SetFont('dejavusans', 'B', 8.5);

        $h = 8.0;
        $cx = $x;
        foreach ($cols as $idx => $cw) {
            $align = in_array($idx, [4, 5, 6], true) ? 'R' : 'C';
            $pdf->SetXY($cx, $y);
            $pdf->Cell($cw, $h, $labels[$idx], 1, 0, $align, true);
            $cx += $cw;
        }

        return $y + $h;
    }

    private function drawTotalRow($pdf, float $x, float $y, float $labelW, float $valueW, string $label, float $value, bool $grand): float
    {
        if ($y + 8 > $pdf->getPageHeight() - 12) {
            $pdf->AddPage('P', 'A4');
            $y = 10;
        }

        $pdf->SetFillColor(248, 250, 252);
        $pdf->SetTextColor(17, 24, 39);
        $pdf->SetDrawColor(229, 231, 235);
        $pdf->SetFont('dejavusans', 'B', $grand ? 9.2 : 8.6);

        if ($grand) {
            $pdf->SetLineWidth(0.5);
            $pdf->SetDrawColor(34, 197, 94);
        } else {
            $pdf->SetLineWidth(0.2);
        }

        $pdf->SetXY($x, $y);
        $pdf->Cell($labelW, 8, $label, 1, 0, 'R', true);
        $pdf->Cell($valueW, 8, $this->eur($value), 1, 0, 'R', true);

        return $y + 8;
    }

    private function renderRollSummary($pdf, array $payload, float $y): void
    {
        $suppliers = $payload['roll_distribution']['suppliers'] ?? [];
        if (empty($suppliers)) {
            $pdf->SetTextColor(100, 116, 139);
            $pdf->SetFont('dejavusans', '', 7.8);
            $pdf->SetXY(8, $y + 3);
            $pdf->Cell(194, 4, 'Document genere le ' . now()->format('d/m/Y H:i'), 0, 1, 'L');
            return;
        }

        $pdf->AddPage('P', 'A4');
        $x = 8.0;
        $y = 10.0;
        $contentW = 194.0;

        $pdf->SetTextColor(22, 101, 52);
        $pdf->SetFont('dejavusans', 'B', 12);
        $pdf->SetXY($x, $y);
        $pdf->Cell(194, 6, 'Repartition des rolls', 0, 1, 'L');
        $y += 8.0;

        foreach ($suppliers as $supplier) {
            $rolls = is_array($supplier['rolls'] ?? null) ? $supplier['rolls'] : [];

            if ($y + 24 > $pdf->getPageHeight() - 16) {
                $pdf->AddPage('P', 'A4');
                $y = 10.0;
                $pdf->SetTextColor(22, 101, 52);
                $pdf->SetFont('dejavusans', 'B', 12);
                $pdf->SetXY($x, $y);
                $pdf->Cell(194, 6, 'Repartition des rolls (suite)', 0, 1, 'L');
                $y += 8.0;
            }

            // Bandeau fournisseur
            $pdf->SetFillColor(240, 253, 244);
            $pdf->SetDrawColor(187, 247, 208);
            $pdf->Rect($x, $y, $contentW, 8.0, 'DF');

            $pdf->SetTextColor(17, 24, 39);
            $pdf->SetFont('dejavusans', 'B', 9.0);
            $pdf->SetXY($x + 2, $y + 1.7);
            $pdf->Cell(120, 4, $this->truncateText((string) ($supplier['name'] ?? '-'), 64), 0, 0, 'L');

            $pdf->SetFont('dejavusans', '', 8.0);
            $pdf->SetTextColor(55, 65, 81);
            $pdf->SetXY($x + 118, $y + 1.7);
            $pdf->Cell(74, 4, 'Rolls: ' . (int) ($supplier['roll_count'] ?? 0) . '  |  Coef moy: ' . number_format((float) ($supplier['coef_avg'] ?? 0), 1, ',', ' ') . '%', 0, 0, 'R');
            $y += 9.5;

            $country = strtoupper((string) ($supplier['country'] ?? ''));
            $this->drawCountryFlag($pdf, $x + 1.0, $y + 0.8, 7.0, 4.6, $country);

            $pdf->SetTextColor(75, 85, 99);
            $pdf->SetFont('dejavusans', '', 7.8);
            $meta = 'Pays: ' . ($country !== '' ? $country : '-')
                . '  |  Mini: ' . (int) ($supplier['mini'] ?? 0)
                . '  |  Etages: ' . (int) ($supplier['floor_count'] ?? 0)
                . '  |  Cartons: ' . (int) ($supplier['carton_count'] ?? 0)
                . '  |  Perte: ' . number_format((float) ($supplier['loss_total'] ?? 0), 1, ',', ' ');
            $pdf->SetXY($x + 9.0, $y + 1.0);
            $pdf->Cell($contentW - 10, 4, $meta, 0, 0, 'L');
            $y += 7.0;

            if (empty($rolls)) {
                $pdf->SetTextColor(100, 116, 139);
                $pdf->SetFont('dejavusans', '', 7.6);
                $pdf->SetXY($x + 1.0, $y + 1.0);
                $pdf->Cell($contentW - 2, 4, 'Mode hors roll pour ce fournisseur.', 0, 0, 'L');
                $y += 7.5;
                continue;
            }

            $y = $this->drawSupplierRollCards($pdf, $x, $y, $contentW, $supplier);
            $y += 2.5;
        }

        $pdf->SetTextColor(100, 116, 139);
        $pdf->SetFont('dejavusans', '', 7.8);
        $pdf->SetXY(8, $y + 3);
        $pdf->Cell(194, 4, 'Document genere le ' . now()->format('d/m/Y H:i') , 0, 1, 'L');
    }

    private function drawSupplierRollCards($pdf, float $x, float $y, float $contentW, array $supplier): float
    {
        $rolls = is_array($supplier['rolls'] ?? null) ? $supplier['rolls'] : [];
        $cardW = 60.0;
        $cardH = 76.0;
        $gapX = 7.0;
        $gapY = 7.0;
        $perRow = max(1, (int) floor(($contentW + $gapX) / ($cardW + $gapX)));
        $idx = 0;
        $startY = $y;

        foreach ($rolls as $roll) {
            $col = $idx % $perRow;
            if ($col === 0 && $idx > 0) {
                $startY += $cardH + $gapY;
            }

            if ($col === 0 && $startY + $cardH > $pdf->getPageHeight() - 16) {
                $pdf->AddPage('P', 'A4');
                $startY = 12.0;
                $pdf->SetTextColor(22, 101, 52);
                $pdf->SetFont('dejavusans', 'B', 10.0);
                $pdf->SetXY($x, $startY);
                $pdf->Cell($contentW, 5, 'Rolls - ' . $this->truncateText((string) ($supplier['name'] ?? '-'), 52), 0, 1, 'L');
                $startY += 6.5;
            }

            $cardX = $x + ($col * ($cardW + $gapX));
            $this->drawSingleRollCard($pdf, $cardX, $startY, $cardW, $cardH, (array) $roll, $idx + 1);
            $idx++;
        }

        if ($idx === 0) {
            return $y;
        }

        $rows = (int) ceil($idx / $perRow);
        return $startY + ($rows > 1 ? 0 : 0) + $cardH;
    }

    private function drawSingleRollCard($pdf, float $x, float $y, float $w, float $h, array $roll, int $index): void
    {
        $pdf->SetDrawColor(203, 213, 225);
        $pdf->SetFillColor(255, 255, 255);
        $pdf->SetLineWidth(0.2);
        $pdf->Rect($x, $y, $w, $h, 'DF');

        $pdf->SetFillColor(241, 245, 249);
        $pdf->Rect($x, $y, $w, 8.5, 'DF');

        $coef = number_format((float) ($roll['coef'] ?? 0), 1, ',', ' ');
        $perte = number_format((float) ($roll['perte'] ?? 0), 1, ',', ' ');
        $pdf->SetTextColor(17, 24, 39);
        $pdf->SetFont('dejavusans', 'B', 7.8);
        $pdf->SetXY($x + 1.4, $y + 2.0);
        $pdf->Cell($w - 2.8, 3.8, 'Roll #' . $index . '  ' . $coef . '%', 0, 0, 'L');

        $pdf->SetFont('dejavusans', '', 6.8);
        $pdf->SetTextColor(75, 85, 99);
        $pdf->SetXY($x + 1.4, $y + 5.4);
        $pdf->Cell($w - 2.8, 3.2, 'perte ' . $perte . ' - etages ' . (int) ($roll['nbetages'] ?? 0), 0, 0, 'L');

        $shellX = $x + 4.0;
        $shellY = $y + 11.0;
        $shellW = $w - 8.0;
        $shellH = $h - 15.0;

        $pdf->SetDrawColor(148, 163, 184);
        $pdf->SetFillColor(248, 250, 252);
        $pdf->Rect($shellX, $shellY, $shellW, $shellH, 'DF');

        $etages = is_array($roll['etages'] ?? null) ? $roll['etages'] : [];
        if (empty($etages)) {
            $pdf->SetTextColor(100, 116, 139);
            $pdf->SetFont('dejavusans', '', 7.0);
            $pdf->SetXY($shellX, $shellY + ($shellH / 2) - 2);
            $pdf->Cell($shellW, 4, 'Aucun etage', 0, 0, 'C');
            return;
        }

        $etages = $this->sortEtagesMostFilledBottom($etages);

        $maxFloors = 12;
        if (count($etages) > $maxFloors) {
            $etages = array_slice($etages, 0, $maxFloors);
        }

        $totalHeightUnits = 0.0;
        foreach ($etages as $etage) {
            $totalHeightUnits += $this->etageHeightUnits((array) $etage);
        }
        $totalHeightUnits = max(0.1, $totalHeightUnits);

        // Echelle unique pour conserver le rapport largeur/hauteur des cartons.
        $scale = min(($shellW - 0.8) / 100.0, ($shellH - 0.8) / $totalHeightUnits);
        $usedW = 100.0 * $scale;
        $usedH = $totalHeightUnits * $scale;

        $drawX = $shellX + (($shellW - $usedW) / 2);
        $drawY = $shellY + ($shellH - $usedH);
        $cursorY = $drawY + $usedH;

        foreach ($etages as $etage) {
            $etage = (array) $etage;
            $etageUnits = $this->etageHeightUnits($etage);
            $floorH = max(0.4, $etageUnits * $scale);
            $fy = $cursorY - $floorH;

            $pdf->SetDrawColor(203, 213, 225);
            $pdf->SetFillColor(255, 255, 255);
            $pdf->Rect($drawX, $fy, $usedW, $floorH, 'DF');

            $cartons = is_array($etage['cartons'] ?? null) ? $etage['cartons'] : [];
            if (empty($cartons) && !empty($etage['items']) && is_array($etage['items'])) {
                foreach ($etage['items'] as $itemId) {
                    $cartons[] = ['product_id' => $itemId, 'x' => 1.0, 'y' => $etageUnits];
                }
            }

            $cx = $drawX;
            $maxX = $drawX + $usedW;
            foreach ($cartons as $carton) {
                $unit = max(0.1, (float) ($carton['x'] ?? 1.0));
                $cw = max(0.2, $unit * $scale);
                if ($cx >= $maxX) {
                    break;
                }
                if ($cx + $cw > $maxX) {
                    $cw = max(0.2, $maxX - $cx);
                }

                $cartonHUnits = max(0.1, (float) ($carton['y'] ?? $etageUnits));
                $ch = min($floorH - 0.2, max(0.2, $cartonHUnits * $scale));
                $cy = $fy + ($floorH - $ch);
                $color = $this->productColor((int) ($carton['product_id'] ?? 0));

                $pdf->SetFillColor($color[0], $color[1], $color[2]);
                $pdf->SetDrawColor(255, 255, 255);
                $pdf->Rect($cx, $cy, max(0.2, $cw - 0.08), max(0.2, $ch - 0.08), 'DF');
                $cx += $cw;
            }

            if ($cx < $maxX - 0.15) {
                $pdf->SetFillColor(241, 245, 249);
                $pdf->SetDrawColor(226, 232, 240);
                $pdf->Rect($cx, $fy + 0.1, $maxX - $cx, max(0.2, $floorH - 0.2), 'DF');
            }

            $cursorY = $fy;
        }

        $pdf->SetDrawColor(148, 163, 184);
        $pdf->SetLineWidth(0.25);
        $pdf->Rect($shellX, $shellY, $shellW, $shellH);
    }

    private function sortEtagesMostFilledBottom(array $etages): array
    {
        usort($etages, function (array $a, array $b): int {
            $fillA = $this->etageFillScore($a);
            $fillB = $this->etageFillScore($b);

            if (abs($fillA - $fillB) > 0.0001) {
                return $fillB <=> $fillA;
            }

            $yA = (float) ($a['y'] ?? 0);
            $yB = (float) ($b['y'] ?? 0);
            if (abs($yA - $yB) > 0.0001) {
                return $yB <=> $yA;
            }

            $countA = is_array($a['cartons'] ?? null) ? count($a['cartons']) : count((array) ($a['items'] ?? []));
            $countB = is_array($b['cartons'] ?? null) ? count($b['cartons']) : count((array) ($b['items'] ?? []));

            return $countB <=> $countA;
        });

        return $etages;
    }

    private function etageFillScore(array $etage): float
    {
        $x = max(0.0, (float) ($etage['x'] ?? 100.0));
        $loss = max(0.0, (float) ($etage['perte'] ?? 0.0));
        $fill = $x - $loss;

        return max(0.0, min(100.0, $fill));
    }

    private function etageHeightUnits(array $etage): float
    {
        $h = (float) ($etage['y'] ?? 0);
        if ($h > 0) {
            return $h;
        }

        $cartons = is_array($etage['cartons'] ?? null) ? $etage['cartons'] : [];
        if (!empty($cartons)) {
            $max = 0.0;
            foreach ($cartons as $carton) {
                $max = max($max, (float) ($carton['y'] ?? 0));
            }
            if ($max > 0) {
                return $max;
            }
        }

        return 1.0;
    }

    private function productColor(int $productId): array
    {
        $palette = [
            [59, 130, 246],
            [16, 185, 129],
            [245, 158, 11],
            [236, 72, 153],
            [99, 102, 241],
            [34, 197, 94],
            [234, 88, 12],
            [20, 184, 166],
            [168, 85, 247],
            [244, 63, 94],
        ];

        $idx = abs($productId) % count($palette);
        return $palette[$idx];
    }

    private function drawCountryFlag($pdf, float $x, float $y, float $w, float $h, string $countryCode): void
    {
        $cc = strtoupper(trim($countryCode));
        $pdf->SetDrawColor(182, 190, 199);
        $pdf->SetLineWidth(0.15);
        $pdf->SetFillColor(255, 255, 255);
        $pdf->Rect($x, $y, $w, $h, 'DF');

        switch ($cc) {
            case 'FR':
                $pdf->SetFillColor(0, 85, 164);
                $pdf->Rect($x, $y, $w / 3, $h, 'F');
                $pdf->SetFillColor(239, 65, 53);
                $pdf->Rect($x + (2 * $w / 3), $y, $w / 3, $h, 'F');
                break;
            case 'DE':
                $pdf->SetFillColor(0, 0, 0);
                $pdf->Rect($x, $y, $w, $h / 3, 'F');
                $pdf->SetFillColor(221, 0, 0);
                $pdf->Rect($x, $y + $h / 3, $w, $h / 3, 'F');
                $pdf->SetFillColor(255, 206, 0);
                $pdf->Rect($x, $y + (2 * $h / 3), $w, $h / 3, 'F');
                break;
            case 'ES':
                $pdf->SetFillColor(170, 21, 27);
                $pdf->Rect($x, $y, $w, $h * 0.25, 'F');
                $pdf->SetFillColor(241, 191, 0);
                $pdf->Rect($x, $y + $h * 0.25, $w, $h * 0.5, 'F');
                $pdf->SetFillColor(170, 21, 27);
                $pdf->Rect($x, $y + $h * 0.75, $w, $h * 0.25, 'F');
                break;
            case 'IT':
                $pdf->SetFillColor(0, 146, 70);
                $pdf->Rect($x, $y, $w / 3, $h, 'F');
                $pdf->SetFillColor(206, 43, 55);
                $pdf->Rect($x + (2 * $w / 3), $y, $w / 3, $h, 'F');
                break;
            case 'NL':
                $pdf->SetFillColor(174, 28, 40);
                $pdf->Rect($x, $y, $w, $h / 3, 'F');
                $pdf->SetFillColor(33, 70, 139);
                $pdf->Rect($x, $y + (2 * $h / 3), $w, $h / 3, 'F');
                break;
            case 'BE':
                $pdf->SetFillColor(0, 0, 0);
                $pdf->Rect($x, $y, $w / 3, $h, 'F');
                $pdf->SetFillColor(253, 218, 36);
                $pdf->Rect($x + ($w / 3), $y, $w / 3, $h, 'F');
                $pdf->SetFillColor(239, 51, 64);
                $pdf->Rect($x + (2 * $w / 3), $y, $w / 3, $h, 'F');
                break;
            default:
                $pdf->SetTextColor(100, 116, 139);
                $pdf->SetFont('dejavusans', '', 6.4);
                $pdf->SetXY($x, $y + 0.4);
                $pdf->Cell($w, $h - 0.8, $cc !== '' ? $cc : '-', 0, 0, 'C');
                $pdf->SetTextColor(17, 24, 39);
                break;
        }
    }

    private function resolveUserLogoPath($user): ?string
    {
        if (!$user || !isset($user->usersMeta)) {
            return null;
        }

        $logo = $user->usersMeta->firstWhere('key', 'logo');
        if (!$logo || empty($logo->value)) {
            return null;
        }

        $value = (string) $logo->value;
        if (Storage::disk('public')->exists($value)) {
            return Storage::disk('public')->path($value);
        }
        if (Storage::disk('local')->exists($value)) {
            return Storage::disk('local')->path($value);
        }
        if (is_file($value) && is_readable($value)) {
            return $value;
        }

        return null;
    }

    private function resolveProductThumbPath($product): ?string
    {
        if (!method_exists($product, 'getFirstMedia')) {
            return null;
        }

        $media = $product->getFirstMedia('images');
        if (!$media) {
            return null;
        }

        $path = null;
        if (method_exists($media, 'hasGeneratedConversion') && $media->hasGeneratedConversion('thumb')) {
            $path = $media->getPath('thumb');
        } else {
            $path = $media->getPath();
        }

        return ($path && is_file($path) && is_readable($path)) ? $path : null;
    }

    private function truncateText(string $text, int $max): string
    {
        $text = trim(preg_replace('/\s+/', ' ', $text));
        if ($text === '') {
            return '-';
        }

        if (mb_strlen($text) <= $max) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, max(1, $max - 1))) . '…';
    }

    private function normalizeEan13(string $eanDigits): ?string
    {
        $digits = preg_replace('/\D+/', '', $eanDigits);
        if ($digits === null || $digits === '') {
            return null;
        }

        if (strlen($digits) === 12 || strlen($digits) === 13) {
            return $digits;
        }

        return null;
    }

    private function buildPotHeightLine($product): ?string
    {
        $pot = isset($product->pot) ? (float) $product->pot : 0.0;
        $height = isset($product->height) ? (float) $product->height : 0.0;

        if ($pot <= 0 && $height <= 0) {
            return null;
        }

        $parts = [];
        if ($pot > 0) {
            $parts[] = 'Pot ' . number_format($pot, 1, ',', ' ') . ' cm';
        }
        if ($height > 0) {
            $parts[] = 'Ht ' . number_format($height, 1, ',', ' ') . ' cm';
        }

        return implode(' - ', $parts);
    }

    private function eur(float $value): string
    {
        return number_format($value, 2, ',', ' ') . ' EUR';
    }
}
