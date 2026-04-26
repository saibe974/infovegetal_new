<?php

namespace App\Services;

class ProductImportPreAnalyzer
{
    private const FIELD_ALIASES = [
        'ref' => ['ref', 'reference', 'reference-produit', 'reference-fournisseur', 'product-reference', 'supplier-reference', 'sku', 'code-produit', 'code-article'],
        'ean13' => ['ean', 'ean13', 'code-barres', 'codebarres', 'barcode', 'gtin'],
        'name' => ['name', 'nom', 'designation', 'design', 'libelle', 'product-name', 'product'],
        'price' => ['price', 'prix', 'tarif', 'prix-ht', 'price-ht', 'prix-unitaire', 'pu'],
        'stock' => ['stock', 'qty', 'quantity', 'quantite', 'disponible', 'availability'],
        'category_products_id' => ['category', 'categorie', 'famille', 'rayon', 'catalogue'],
        'description' => ['description', 'desc', 'details'],
        'img_link' => ['image', 'img', 'photo', 'image-url', 'photo-url'],
        'active' => ['active', 'actif', 'enabled'],
    ];

    public function __construct(
        private readonly ImportSourceReader $sourceReader,
    ) {}

    public function analyze(string $fullPath, ?int $forcedHeaderRowIndex = null, ?string $forcedDelimiter = null): array
    {
        $preview = $this->sourceReader->preview($fullPath, 25, $forcedDelimiter);
        $rows = $preview['rows'];

        if ($rows === []) {
            throw new \RuntimeException('Le fichier exemple est vide ou illisible.');
        }

        $headerCandidates = $this->rankHeaderRows($rows);
        $detectedHeaderRowIndex = $forcedHeaderRowIndex ?? ($headerCandidates[0]['index'] ?? ($rows[0]['index'] ?? 0));
        $columns = $this->buildColumns($rows, $detectedHeaderRowIndex);

        return [
            'format' => $preview['format'],
            'source_delimiter' => $preview['delimiter'],
            'rows' => $rows,
            'detected_header_row_index' => $detectedHeaderRowIndex,
            'header_candidates' => array_slice($headerCandidates, 0, 5),
            'columns' => $columns,
        ];
    }

    private function rankHeaderRows(array $rows): array
    {
        $ranked = [];
        $candidateRows = array_slice($rows, 0, 20);

        foreach ($candidateRows as $position => $row) {
            $cells = $row['cells'] ?? [];
            $nonEmptyCells = array_values(array_filter($cells, fn (string $value) => $value !== ''));
            if ($nonEmptyCells === []) {
                $ranked[] = ['index' => $row['index'], 'score' => 0];
                continue;
            }

            $score = min(count($nonEmptyCells), 8);
            $normalizedCells = array_map(fn (string $value) => $this->sourceReader->normalizeKey($value), $nonEmptyCells);

            foreach ($normalizedCells as $normalized) {
                foreach (self::FIELD_ALIASES as $aliases) {
                    foreach ($aliases as $alias) {
                        if ($normalized === $alias) {
                            $score += 6;
                            continue 3;
                        }

                        if ($normalized !== '' && str_contains($normalized, $alias)) {
                            $score += 3;
                            continue 3;
                        }
                    }
                }
            }

            $nextRows = array_slice($rows, $position + 1, 5);
            $score += $this->scoreFollowingRows($cells, $nextRows);

            if ($this->looksLikeFreeText($nonEmptyCells)) {
                $score -= 4;
            }

            $ranked[] = [
                'index' => $row['index'],
                'score' => $score,
            ];
        }

        usort($ranked, fn (array $left, array $right) => $right['score'] <=> $left['score']);

        return $ranked;
    }

    private function buildColumns(array $rows, int $headerRowIndex): array
    {
        $headerRow = collect($rows)->firstWhere('index', $headerRowIndex);
        $headerCells = $headerRow['cells'] ?? [];
        $maxColumns = max(array_map(fn (array $row) => count($row['cells'] ?? []), $rows));
        $headerPosition = 0;

        foreach ($rows as $position => $row) {
            if (($row['index'] ?? null) === $headerRowIndex) {
                $headerPosition = $position;
                break;
            }
        }

        $sampleRows = array_values(array_filter(
            array_slice($rows, $headerPosition + 1, 8),
            fn (array $row) => array_filter($row['cells'] ?? [], fn (string $value) => $value !== '') !== []
        ));

        $columns = [];
        for ($columnIndex = 0; $columnIndex < $maxColumns; $columnIndex++) {
            $label = trim((string) ($headerCells[$columnIndex] ?? ''));
            if ($label === '') {
                $label = 'Column ' . ($columnIndex + 1);
            }

            $normalizedKey = $this->sourceReader->normalizeKey($label);
            $samples = [];
            foreach ($sampleRows as $row) {
                $value = trim((string) ($row['cells'][$columnIndex] ?? ''));
                if ($value !== '') {
                    $samples[] = $value;
                }
                if (count($samples) >= 3) {
                    break;
                }
            }

            $candidates = $this->scoreColumnCandidates($label, $normalizedKey, $samples);

            $columns[] = [
                'index' => $columnIndex,
                'source_label' => $label,
                'normalized_key' => $normalizedKey,
                'samples' => $samples,
                'suggested_target' => $candidates[0]['field'] ?? null,
                'candidates' => array_slice($candidates, 0, 3),
            ];
        }

        return $columns;
    }

    private function scoreFollowingRows(array $headerCells, array $nextRows): int
    {
        if ($nextRows === []) {
            return 0;
        }

        $score = 0;
        foreach ($headerCells as $columnIndex => $headerCell) {
            $normalizedHeader = $this->sourceReader->normalizeKey((string) $headerCell);
            $samples = [];
            foreach ($nextRows as $row) {
                $value = trim((string) ($row['cells'][$columnIndex] ?? ''));
                if ($value !== '') {
                    $samples[] = $value;
                }
            }

            if ($samples === []) {
                continue;
            }

            if ($this->matchesAnyAlias($normalizedHeader, self::FIELD_ALIASES['ean13']) && $this->containsValidEanSamples($samples)) {
                $score += 5;
            }

            if ($this->matchesAnyAlias($normalizedHeader, self::FIELD_ALIASES['price']) && $this->containsNumericSamples($samples)) {
                $score += 4;
            }

            if ($this->matchesAnyAlias($normalizedHeader, self::FIELD_ALIASES['ref']) && $this->containsReferenceSamples($samples)) {
                $score += 3;
            }

            if ($this->matchesAnyAlias($normalizedHeader, self::FIELD_ALIASES['name']) && $this->containsTextSamples($samples)) {
                $score += 2;
            }
        }

        return $score;
    }

    private function scoreColumnCandidates(string $label, string $normalizedKey, array $samples): array
    {
        $candidates = [];

        foreach (self::FIELD_ALIASES as $field => $aliases) {
            $score = 0;

            foreach ($aliases as $alias) {
                if ($normalizedKey === $alias) {
                    $score += 8;
                    continue;
                }

                if ($normalizedKey !== '' && str_contains($normalizedKey, $alias)) {
                    $score += 4;
                }
            }

            $score += match ($field) {
                'ean13' => $this->containsValidEanSamples($samples) ? 6 : 0,
                'price' => $this->containsNumericSamples($samples) ? 4 : 0,
                'stock' => $this->containsIntegerSamples($samples) ? 4 : 0,
                'ref' => $this->containsReferenceSamples($samples) ? 3 : 0,
                'name', 'description', 'category_products_id' => $this->containsTextSamples($samples) ? 2 : 0,
                default => 0,
            };

            if ($score > 0) {
                $candidates[] = [
                    'field' => $field,
                    'score' => $score,
                    'label' => $label,
                ];
            }
        }

        usort($candidates, fn (array $left, array $right) => $right['score'] <=> $left['score']);

        return $candidates;
    }

    private function matchesAnyAlias(string $normalizedHeader, array $aliases): bool
    {
        foreach ($aliases as $alias) {
            if ($normalizedHeader === $alias || ($normalizedHeader !== '' && str_contains($normalizedHeader, $alias))) {
                return true;
            }
        }

        return false;
    }

    private function looksLikeFreeText(array $values): bool
    {
        $longValues = array_filter($values, fn (string $value) => mb_strlen($value) > 40);

        return count($longValues) >= max(1, (int) floor(count($values) / 2));
    }

    private function containsValidEanSamples(array $samples): bool
    {
        foreach ($samples as $sample) {
            if ($this->isValidEan13($sample)) {
                return true;
            }
        }

        return false;
    }

    private function containsNumericSamples(array $samples): bool
    {
        foreach ($samples as $sample) {
            $normalized = str_replace([' ', ','], ['', '.'], $sample);
            if (is_numeric($normalized)) {
                return true;
            }
        }

        return false;
    }

    private function containsIntegerSamples(array $samples): bool
    {
        foreach ($samples as $sample) {
            if (preg_match('/^\d+$/', str_replace(' ', '', $sample))) {
                return true;
            }
        }

        return false;
    }

    private function containsReferenceSamples(array $samples): bool
    {
        foreach ($samples as $sample) {
            if (preg_match('/^[A-Za-z0-9._\/-]{3,}$/', trim($sample))) {
                return true;
            }
        }

        return false;
    }

    private function containsTextSamples(array $samples): bool
    {
        foreach ($samples as $sample) {
            if (preg_match('/[A-Za-z\p{L}]/u', $sample)) {
                return true;
            }
        }

        return false;
    }

    private function isValidEan13(string $value): bool
    {
        $digits = preg_replace('/\D+/', '', $value);
        if (strlen($digits) !== 13) {
            return false;
        }

        $sum = 0;
        for ($index = 0; $index < 12; $index++) {
            $digit = (int) $digits[$index];
            $sum += $index % 2 === 0 ? $digit : $digit * 3;
        }

        $checksum = (10 - ($sum % 10)) % 10;

        return $checksum === (int) $digits[12];
    }
}