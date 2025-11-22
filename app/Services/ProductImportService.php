<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use League\Csv\Reader;
use League\Csv\Writer;

class ProductImportService
{
    public function run(string $id, string $fullPath, string $relativePath, int $limit = 4000): void
    {
        // Première étape : découper le fichier CSV source en fichiers temporaires de données
        $this->splitIntoTempFiles($id, $fullPath, $limit);

        // ❌ Ne pas lancer le traitement d'import pour l'instant
        $this->runChunk($id, $relativePath, 0);
    }

    public function runChunk(string $id, string $relativePath, int $chunkIndex): void
    {
        try {
            $normalizeKey = function ($value): string {
                $string = (string) $value;
                $string = preg_replace('/^\xEF\xBB\xBF/', '', $string);
                return mb_strtolower(trim($string));
            };

            $state = Cache::get("import:$id", []);
            $total = isset($state['total']) ? (int) $state['total'] : 0;

            $processed = isset($state['processed']) ? (int) $state['processed'] : 0;
            $errors = isset($state['errors']) ? (int) $state['errors'] : 0;

            $tempDir = Storage::path('imports/tmp/' . $id);
            $dataFile = $tempDir . DIRECTORY_SEPARATOR . 'data_' . $chunkIndex . '.csv';

            if (!is_file($dataFile)) {
                Log::info("No data file for chunk $chunkIndex, nothing to process for ID: $id");
                return;
            }

            Storage::makeDirectory('imports/reports');
            $reportPath = Storage::path('imports/reports/' . $id . '.csv');
            $reportHandle = fopen($reportPath, file_exists($reportPath) ? 'a' : 'w');
            if ($reportHandle && !filesize($reportPath)) {
                fputcsv($reportHandle, ['line', 'error', 'sku', 'name', 'raw'], ';');
            }

            // On lit uniquement le fichier de données pour ce chunk
            $reader = Reader::from($dataFile, 'r');
            $reader->setDelimiter(';');
            $reader->setHeaderOffset(0);
            $originalHeaders = $reader->getHeader();

            $keyMap = [];
            foreach ($originalHeaders as $header) {
                $keyMap[$header] = $normalizeKey($header);
            }

            $cancelled = false;

            $updateProgress = function (?array $current) use (&$processed, &$errors, &$total, $id, $relativePath) {
                if ($total <= 0) {
                    return;
                }

                $completed = $processed + $errors;

                if ($completed === 0) {
                    return;
                }

                if ($completed % 500 !== 0 && $completed !== $total) {
                    return;
                }

                Log::info("Import progress update for ID $id: processed=$processed, errors=$errors, total=$total, completed=$completed");

                $this->updateImportState($id, [
                    'status' => 'processing',
                    'processed' => $processed,
                    'total' => $total,
                    'errors' => $errors,
                    'progress' => (int) floor(($completed / max(1, $total)) * 100),
                    'current' => $current,
                    'path' => $relativePath,
                ]);
            };

            $currentIndex = 0;
            $upsertRows = [];

            // Précharger les catégories valides une seule fois
            static $validCategoryIds = null;
            if ($validCategoryIds === null) {
                $validCategoryIds = \App\Models\ProductCategory::pluck('id')->all();
            }

            foreach ($reader->getRecords() as $row) {
                if (Cache::get("import:$id:cancel", false)) {
                    $cancelled = true;
                    break;
                }

                $mapped = [];

                try {
                    $mapped = $this->mapRow($row, $keyMap, $normalizeKey);

                    if (!$this->rowHasContent($mapped)) {
                        $currentIndex++;
                        continue;
                    }

                    $sku = trim((string) ($mapped['sku'] ?? ''));
                    $name = trim((string) ($mapped['name'] ?? ''));
                    $currentSnapshot = [
                        'line' => $processed + $errors + 1,
                        'sku' => $sku !== '' ? $sku : null,
                        'name' => $name !== '' ? $name : null,
                    ];

                    if ($sku === '' || $name === '') {
                        $errors++;
                        $this->writeReportLine($reportHandle, $processed + $errors, 'Missing sku or name', $row, $mapped);
                        $updateProgress($currentSnapshot);
                        $currentIndex++;
                        continue;
                    }

                    $description = isset($mapped['description']) ? trim((string) $mapped['description']) : null;
                    $imgLink = isset($mapped['img']) ? trim((string) $mapped['img']) : null;
                    $price = isset($mapped['price']) && is_numeric($mapped['price']) ? (float) $mapped['price'] : 0;
                    $active = isset($mapped['active']) ? (int) $mapped['active'] : 1;
                    $productCategoryId = isset($mapped['product_category_id']) && is_numeric($mapped['product_category_id']) ? (int) $mapped['product_category_id'] : 51;

                    if (!in_array($productCategoryId, $validCategoryIds, true)) {
                        $productCategoryId = 51;
                    }

                    $upsertRows[] = [
                        'sku' => $sku,
                        'name' => $name,
                        'description' => $description,
                        'img_link' => $imgLink !== null ? 'https://www.infovegetal.com/files/' . $imgLink : null,
                        'price' => $price,
                        'active' => $active,
                        'product_category_id' => $productCategoryId,
                    ];

                    $processed++;
                    $currentSnapshot['line'] = $processed + $errors;
                    $updateProgress($currentSnapshot);
                    $currentIndex++;
                } catch (\Throwable $e) {
                    Log::error('Erreur import: ' . $e->getMessage());
                    $errors++;
                    $this->writeReportLine($reportHandle, $processed + $errors, $e->getMessage(), $row, $mapped ?? []);
                    $currentSnapshot = [
                        'line' => $processed + $errors,
                        'sku' => $mapped['sku'] ?? null,
                        'name' => $mapped['name'] ?? null,
                    ];
                    $updateProgress($currentSnapshot);
                    $currentIndex++;
                }
            }

            // Une fois toutes les lignes du chunk parcourues, exécuter un upsert global
            if (!empty($upsertRows)) {
                Product::withoutEvents(function () use ($upsertRows) {
                    Product::upsert(
                        $upsertRows,
                        ['sku'],
                        ['name', 'description', 'img_link', 'price', 'active', 'product_category_id']
                    );
                });
            }

            if (isset($reportHandle) && $reportHandle) {
                fclose($reportHandle);
                if ($errors === 0 && file_exists($reportPath)) {
                    @unlink($reportPath);
                }
            }

            // On peut supprimer le fichier temporaire de ce chunk
            // @unlink($dataFile);

            $finalState = [
                'processed' => $processed,
                'total' => $total,
                'errors' => $errors,
                'report' => ($errors > 0 && file_exists($reportPath) ? route('products.import.report', ['id' => $id]) : null),
                'path' => $relativePath,
                'next_offset' => $chunkIndex + 1,
                'has_more' => ($chunkIndex + 1) < (int)($state['chunks_count'] ?? 1),
            ];

            if ($cancelled) {
                $this->updateImportState($id, array_merge($finalState, [
                    'status' => 'cancelled',
                    'progress' => (int) floor(((($processed + $errors)) / max(1, $total)) * 100),
                ]));

                Cache::forget("import:$id:cancel");
                Log::info("Import cancelled for ID $id");
                return;
            }

            // Si on a encore des chunks à traiter, on reste en processing
            if ($finalState['has_more']) {
                $this->updateImportState($id, array_merge($finalState, [
                    'status' => 'processing',
                    'progress' => (int) floor(((($processed + $errors)) / max(1, $total)) * 100),
                ]));
                Log::info("Import chunk completed for ID $id: processed=$processed, errors=$errors, next_offset=" . $finalState['next_offset']);
            } else {
                $this->updateImportState($id, array_merge($finalState, [
                    'status' => 'done',
                    'progress' => 100,
                ]));

                Cache::forget("import:$id:cancel");

                Log::info("Import completed for ID $id: processed=$processed, errors=$errors");
            }
        } catch (\Throwable $e) {
            Log::error('Import process failed: ' . $e->getMessage());

            $this->updateImportState($id, [
                'status' => 'error',
                'message' => $e->getMessage(),
                'path' => $relativePath,
            ]);
        }
    }

    private function splitIntoTempFiles(string $id, string $fullPath, int $limit): void
    {
        $normalizeKey = function ($value): string {
            $string = (string) $value;
            $string = preg_replace('/^\xEF\xBB\xBF/', '', $string);
            return mb_strtolower(trim($string));
        };

        $reader = Reader::from($fullPath, 'r');
        $reader->setDelimiter(';');
        $reader->setHeaderOffset(0);

        $headers = $reader->getHeader();

        $total = 0;
        $chunkIndex = 0;
        $rowsInChunk = 0;

        $tempDir = Storage::path('imports/tmp/' . $id);
        if (!is_dir($tempDir)) {
            @mkdir($tempDir, 0777, true);
        }

        /** @var Writer|null $writer */
        $writer = null;

        $openWriter = function () use (&$writer, $tempDir, &$chunkIndex, $headers) {
            $path = $tempDir . DIRECTORY_SEPARATOR . 'data_' . $chunkIndex . '.csv';
            Log::info("[Import][Split] Creating temp chunk file: {$path}");
            $writer = Writer::from($path, 'w+');
            $writer->setDelimiter(';');
            $writer->insertOne($headers);
        };

        foreach ($reader->getRecords() as $row) {
            $mapped = [];
            foreach ($row as $key => $value) {
                $normalizedKey = $normalizeKey($key);
                $mapped[$normalizedKey] = is_string($value) ? trim($value) : $value;
            }

            if (!$this->rowHasContent($mapped)) {
                continue;
            }

            $sku = trim((string) ($mapped['sku'] ?? ''));
            if ($sku === '') {
                continue;
            }

            if ($writer === null) {
                $openWriter();
            }

            if ($rowsInChunk >= $limit) {
                // On passe au chunk suivant
                $writer = null;
                $chunkIndex++;
                $rowsInChunk = 0;
                $openWriter();
            }

            $writer->insertOne($row);
            $rowsInChunk++;
            $total++;
        }

        Log::info("Split CSV for ID $id: total=$total, chunks=" . ($chunkIndex + ($rowsInChunk > 0 ? 1 : 0)));
        
        // Mettre à jour l'état global (total lignes et nombre de chunks)
        $this->updateImportState($id, [
            'total' => $total,
            'chunks_count' => $chunkIndex + ($rowsInChunk > 0 ? 1 : 0),
        ]);
    }

    private function updateImportState(string $id, array $payload): void
    {
        $existing = Cache::get("import:$id", []);
        $state = array_merge($existing, $payload);
        Cache::put("import:$id", $state, now()->addHour());
    }

    private function countValidLines(string $fullPath, callable $normalizeKey): int
    {
        $reader = Reader::from($fullPath, 'r');
        $reader->setDelimiter(';');
        $reader->setHeaderOffset(0);
        $headers = $reader->getHeader();

        $keyMap = [];
        foreach ($headers as $header) {
            $keyMap[$header] = $normalizeKey($header);
        }

        $total = 0;

        foreach ($reader->getRecords() as $row) {
            $mapped = $this->mapRow($row, $keyMap, $normalizeKey);
            if (!$this->rowHasContent($mapped)) {
                continue;
            }

            $sku = trim((string) ($mapped['sku'] ?? ''));
            if ($sku === '') {
                continue;
            }

            $total++;
        }

        return $total;
    }

    private function mapRow(array $row, array $keyMap, callable $normalizeKey): array
    {
        $mapped = [];
        foreach ($row as $key => $value) {
            $normalizedKey = $keyMap[$key] ?? $normalizeKey($key);
            if (is_string($value)) {
                $trimmed = trim($value);
                $mapped[$normalizedKey] = $trimmed === '' ? null : $trimmed;
            } else {
                $mapped[$normalizedKey] = $value;
            }
        }

        return $mapped;
    }

    private function rowHasContent(array $row): bool
    {
        foreach ($row as $value) {
            if ($value !== null && $value !== '') {
                return true;
            }
        }

        return false;
    }

    private function writeReportLine($handle, int $line, string $message, array $rawRow, array $mapped): void
    {
        if (!$handle) {
            return;
        }

        $rawValues = is_array($rawRow) ? implode('|', array_values($rawRow)) : '';

        fputcsv($handle, [
            $line,
            $message,
            $mapped['sku'] ?? null,
            $mapped['name'] ?? null,
            $rawValues,
        ], ';');
    }
}
