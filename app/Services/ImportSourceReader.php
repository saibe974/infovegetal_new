<?php

namespace App\Services;

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;
use Symfony\Component\String\Slugger\AsciiSlugger;

class ImportSourceReader
{
    private const CSV_DELIMITERS = [';', ',', "\t", '|'];

    public function preview(string $fullPath, int $limit = 25, ?string $forcedDelimiter = null): array
    {
        $extension = strtolower((string) pathinfo($fullPath, PATHINFO_EXTENSION));

        if (in_array($extension, ['csv', 'txt'], true)) {
            $delimiter = $forcedDelimiter ?: $this->detectDelimiter($fullPath);

            return [
                'format' => $extension,
                'delimiter' => $delimiter,
                'rows' => $this->previewDelimitedFile($fullPath, $limit, $delimiter),
            ];
        }

        if (!in_array($extension, ['xls', 'xlsx'], true)) {
            throw new \InvalidArgumentException("Unsupported import format: {$extension}");
        }

        return [
            'format' => $extension,
            'delimiter' => null,
            'rows' => $this->previewSpreadsheet($fullPath, $limit),
        ];
    }

    public function normalizeToCsv(string $id, string $fullPath, int $headerRowIndex = 0, ?string $forcedDelimiter = null): string
    {
        $extension = strtolower((string) pathinfo($fullPath, PATHINFO_EXTENSION));

        return match (true) {
            in_array($extension, ['csv', 'txt'], true) => $this->normalizeDelimitedTextToCsv($id, $fullPath, $headerRowIndex, $forcedDelimiter),
            in_array($extension, ['xls', 'xlsx'], true) => $this->normalizeSpreadsheetToCsv($id, $fullPath, $headerRowIndex),
            default => throw new \InvalidArgumentException("Unsupported import format: {$extension}"),
        };
    }

    public function normalizeKey(string $value): string
    {
        $string = preg_replace('/^\xEF\xBB\xBF/', '', $value);
        $string = trim((string) $string);

        return (new AsciiSlugger())->slug($string)->lower()->toString();
    }

    public function detectDelimiter(string $fullPath): string
    {
        $handle = fopen($fullPath, 'r');
        if ($handle === false) {
            return ';';
        }

        $scores = array_fill_keys(self::CSV_DELIMITERS, 0);
        $samples = 0;

        while (!feof($handle) && $samples < 10) {
            $line = fgets($handle);
            if ($line === false) {
                break;
            }

            $line = trim($line);
            if ($line === '') {
                continue;
            }

            foreach (self::CSV_DELIMITERS as $delimiter) {
                $scores[$delimiter] += substr_count($line, $delimiter);
            }

            $samples++;
        }

        fclose($handle);

        arsort($scores);
        $best = array_key_first($scores);

        return $best !== null && $scores[$best] > 0 ? $best : ';';
    }

    private function previewDelimitedFile(string $fullPath, int $limit, string $delimiter): array
    {
        $handle = fopen($fullPath, 'r');
        if ($handle === false) {
            throw new \RuntimeException('Unable to open uploaded file for preview.');
        }

        $rows = [];
        $rowIndex = 0;

        while (!feof($handle) && count($rows) < $limit) {
            $data = fgetcsv($handle, 0, $delimiter);
            if ($data === false) {
                break;
            }

            $rows[] = [
                'index' => $rowIndex,
                'cells' => $this->normalizeCells($data),
            ];

            $rowIndex++;
        }

        fclose($handle);

        return $rows;
    }

    private function previewSpreadsheet(string $fullPath, int $limit): array
    {
        $rows = [];
        $reader = IOFactory::createReaderForFile($fullPath);
        $reader->setReadDataOnly(true);
        $reader->setReadFilter(new class($limit) implements IReadFilter {
            public function __construct(private int $limit) {}

            public function readCell($columnAddress, $row, $worksheetName = '')
            {
                return $row <= $this->limit;
            }
        });

        $spreadsheet = $reader->load($fullPath);
        $sheet = $spreadsheet->getActiveSheet();

        foreach ($sheet->getRowIterator(1, $limit) as $sheetRow) {
            $cellIterator = $sheetRow->getCellIterator();
            $cellIterator->setIterateOnlyExistingCells(false);

            $cells = [];
            foreach ($cellIterator as $cell) {
                $value = $cell->getFormattedValue();
                $cells[] = is_scalar($value) ? (string) $value : '';
            }

            $rows[] = [
                'index' => $sheetRow->getRowIndex() - 1,
                'cells' => $this->normalizeCells($cells),
            ];
        }

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return $rows;
    }

    private function normalizeDelimitedTextToCsv(string $id, string $fullPath, int $headerRowIndex, ?string $forcedDelimiter): string
    {
        $delimiter = $forcedDelimiter ?: $this->detectDelimiter($fullPath);
        $normalizedCsvPath = $this->normalizedCsvPath($id);

        $sourceHandle = fopen($fullPath, 'r');
        $targetHandle = fopen($normalizedCsvPath, 'w');

        if ($sourceHandle === false || $targetHandle === false) {
            throw new \RuntimeException('Unable to create normalized CSV source.');
        }

        $rowIndex = 0;
        $header = null;
        $headerCount = 0;

        while (!feof($sourceHandle)) {
            $data = fgetcsv($sourceHandle, 0, $delimiter);
            if ($data === false) {
                break;
            }

            $cells = $this->normalizeCells($data);

            if ($rowIndex === $headerRowIndex) {
                $header = $this->normalizeHeaderCells($cells);
                $headerCount = count($header);
                fputcsv($targetHandle, $header, ';');
                $rowIndex++;
                continue;
            }

            if ($rowIndex > $headerRowIndex && $this->rowHasValues($cells)) {
                fputcsv($targetHandle, $this->normalizeDataCells($cells, $headerCount), ';');
            }

            $rowIndex++;
        }

        fclose($sourceHandle);
        fclose($targetHandle);

        if ($header === null) {
            throw new \RuntimeException('Unable to detect configured header row in source file.');
        }

        return $normalizedCsvPath;
    }

    private function normalizeSpreadsheetToCsv(string $id, string $fullPath, int $headerRowIndex): string
    {
        $normalizedCsvPath = $this->normalizedCsvPath($id);
        $targetHandle = fopen($normalizedCsvPath, 'w');

        if ($targetHandle === false) {
            throw new \RuntimeException('Unable to create normalized CSV source.');
        }

        $headerSpreadsheetRow = $headerRowIndex + 1;

        $headerRows = $this->readSpreadsheetRows($fullPath, $headerSpreadsheetRow, $headerSpreadsheetRow);
        if ($headerRows === []) {
            fclose($targetHandle);
            throw new \RuntimeException('Configured header row is outside of source bounds.');
        }

        $header = $this->normalizeHeaderCells($headerRows[0] ?? []);
        $headerCount = count($header);
        fputcsv($targetHandle, $header, ';');

        $chunkSize = 500;
        for ($startRow = $headerSpreadsheetRow + 1; ; $startRow += $chunkSize) {
            $endRow = $startRow + $chunkSize - 1;
            $rows = $this->readSpreadsheetRows($fullPath, $startRow, $endRow);
            if ($rows === []) {
                break;
            }

            foreach ($rows as $cells) {
                $normalized = $this->normalizeCells($cells);
                if (!$this->rowHasValues($normalized)) {
                    continue;
                }

                fputcsv($targetHandle, $this->normalizeDataCells($normalized, $headerCount), ';');
            }

            if (count($rows) < $chunkSize) {
                break;
            }
        }

        fclose($targetHandle);

        return $normalizedCsvPath;
    }

    private function readSpreadsheetRows(string $fullPath, int $startRow, int $endRow): array
    {
        $reader = IOFactory::createReaderForFile($fullPath);
        $reader->setReadDataOnly(true);
        $reader->setReadFilter(new class($startRow, $endRow) implements IReadFilter {
            public function __construct(private int $startRow, private int $endRow) {}

            public function readCell($columnAddress, $row, $worksheetName = '')
            {
                return $row >= $this->startRow && $row <= $this->endRow;
            }
        });

        $spreadsheet = $reader->load($fullPath);
        $sheet = $spreadsheet->getActiveSheet();
        $rows = [];

        $highestRow = $sheet->getHighestRow();
        if ($startRow > $highestRow) {
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet);

            return [];
        }

        $endRow = min($endRow, $highestRow);

        foreach ($sheet->getRowIterator($startRow, $endRow) as $sheetRow) {
            $cellIterator = $sheetRow->getCellIterator();
            $cellIterator->setIterateOnlyExistingCells(false);

            $rowData = [];
            foreach ($cellIterator as $cell) {
                $value = $cell->getFormattedValue();
                $rowData[] = is_scalar($value) ? (string) $value : '';
            }

            $rows[] = $rowData;
        }

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return $rows;
    }

    private function normalizeCells(array $cells): array
    {
        return array_map(function ($value) {
            if ($value === null) {
                return '';
            }

            $string = is_scalar($value) ? (string) $value : '';
            $string = str_replace(["\r\n", "\r"], "\n", $string);

            return trim($string);
        }, $cells);
    }

    private function normalizeHeaderCells(array $cells): array
    {
        $header = [];

        foreach ($cells as $index => $cell) {
            $label = trim((string) $cell);
            $header[] = $label !== '' ? $label : 'Column ' . ($index + 1);
        }

        if ($header === []) {
            $header[] = 'Column 1';
        }

        return $header;
    }

    private function normalizeDataCells(array $cells, int $headerCount): array
    {
        if ($headerCount <= 0) {
            return $cells;
        }

        if (count($cells) < $headerCount) {
            return array_pad($cells, $headerCount, '');
        }

        if (count($cells) > $headerCount) {
            return array_slice($cells, 0, $headerCount);
        }

        return $cells;
    }

    private function rowHasValues(array $cells): bool
    {
        foreach ($cells as $value) {
            if ($value !== '') {
                return true;
            }
        }

        return false;
    }

    private function normalizedCsvPath(string $id): string
    {
        $tempDir = storage_path('app/imports/tmp/' . $id);
        if (!is_dir($tempDir)) {
            @mkdir($tempDir, 0777, true);
        }

        return $tempDir . DIRECTORY_SEPARATOR . 'source_normalized.csv';
    }
}