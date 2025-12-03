<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use League\Csv\Reader;
use League\Csv\Writer;
use Symfony\Component\String\Slugger\AsciiSlugger;

class ProductImportService
{
    public function run(string $id, string $fullPath, string $relativePath, int $limit = 4000): void
    {
        // Première étape : découper le fichier CSV source en fichiers temporaires de données
        $this->splitIntoTempFiles($id, $fullPath, $limit);

        $this->runChunk($id, $relativePath, 0);
    }

    public function runChunk(string $id, string $relativePath, int $chunkIndex): void
    {
        try {
            $normalizeKey = function ($value): string {
                $string = (string) $value;
                $string = preg_replace('/^\xEF\xBB\xBF/', '', $string);
                $string = trim($string);
                $slugger = new AsciiSlugger();
                // Slug hyphen-case afin de rendre les en-têtes stables: ex "prix plaque" => "prix-plaque"
                return $slugger->slug($string)->lower()->toString();
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

            // Préparer le fichier de rapport d'erreurs
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

            // Précharger les IDs valides de category_products
            static $validCategoryIds = null;
            if ($validCategoryIds === null) {
                try {
                    $validCategoryIds = \App\Models\CategoryProducts::pluck('id')->all();
                } catch (\Throwable $e) {
                    Log::warning('[Import]['.$id.'] Impossible de charger category_products ids: '.$e->getMessage());
                    $validCategoryIds = [];
                }
            }
            
            // Charger un éventuel mapping personnalisé (db_products_id)
            $dbProductsId = isset($state['db_products_id']) && is_numeric($state['db_products_id'])
                ? (int) $state['db_products_id']
                : null;
            $defaultsMap = null;
            $defaultsMapCategories = [];
            $traitement = null;
            // Log::info("[Import][$id] db_products_id from state=", ['db_products_id' => $dbProductsId]);
            if ($dbProductsId) {
                try {
                    /** @var \App\Models\DbProducts|null $dbp */
                    $dbp = \App\Models\DbProducts::find($dbProductsId);
                    // Log::info("[Import][$id] DbProducts loaded", [
                    //     'id' => $dbProductsId,
                    //     'has_defaults' => $dbp && is_array($dbp->defaults),
                    // ]);
                    if ($dbp && is_array($dbp->champs) && !empty($dbp->champs)) {
                        $defaultsMap = $dbp->champs;
                        // Log::info("[Import][$id] defaultsMap set", ['defaults' => $defaultsMap]);
                    }

                    if ($dbp && is_array($dbp->categories) && !empty($dbp->categories)) {
                        $defaultsMapCategories = $dbp->categories;
                        // Log::info("[Import][$id] defaultsMap set", ['defaults' => $defaultsMap]);
                    }

                    if ($dbp && $dbp->traitement) {
                        $traitementPath = __DIR__ . '/ProductImportTraitement/' . $dbp->traitement . '.php';
                        if (file_exists($traitementPath)) {
                            $traitement = $dbp->traitement;
                            require_once $traitementPath;
                            Log::info("[Import][$id] Traitement loaded: {$dbp->traitement}");
                        } else {
                            Log::warning("[Import][$id] Traitement file not found: {$traitementPath}");
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning('Unable to load DbProducts defaults: ' . $e->getMessage());
                }
            }
            $resolve = function (array $mapped, ?array $defaultsMap, string $targetKey) {
                if (is_array($defaultsMap)) {
                    // Mapping : source -> cible
                    $sourceKey = array_search($targetKey, $defaultsMap, true);
                    if ($sourceKey !== false) {
                        $sourceKey = (string) $sourceKey;
                        if ($sourceKey !== '') {
                            return $mapped[$sourceKey] ?? null;
                        }
                    }
                }
                return $mapped[$targetKey] ?? null;
            };

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

                    $f = null;
                    if($traitement)
                        $f = 'importProducts_'.$traitement;
                    if(function_exists($f)):
                        $newRow = $f(array(
                            'mapped' => $mapped, 
                            'defaultsMap' => $defaultsMap,
                            'processed' => $processed,
                            'errors' => $errors,
                            'reportHandle' => $reportHandle,
                            'updateProgress' => $updateProgress,
                            'currentIndex' => $currentIndex,
                            'validCategoryIds' => $validCategoryIds,
                            'defaultsMapCategories' => $defaultsMapCategories,
                        ), $resolve);

                        if(isset($newRow['error'])):
                            $errors++;
                            $this->writeReportLine($reportHandle, $processed + $errors, $newRow['error'], $row, $mapped);
                            $currentSnapshot = [
                                'line' => $processed + $errors,
                                'sku' => $mapped['sku'] ?? null,
                                'name' => $mapped['name'] ?? null,
                            ];
                            $updateProgress($currentSnapshot);
                            $currentIndex++;
                            continue;
                        endif;
                    else:
                        $sku = trim((string) ($resolve($mapped, $defaultsMap, 'sku') ?? ''));
                        $name = trim((string) ($resolve($mapped, $defaultsMap, 'name') ?? ''));
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

                        $description = $resolve($mapped, $defaultsMap, 'description');
                        $description = $description !== null ? trim((string) $description) : null;

                        $imgLink = $resolve($mapped, $defaultsMap, 'img_link');
                        $imgLink = $imgLink !== null ? trim((string) $imgLink) : null;

                        $priceVal = $resolve($mapped, $defaultsMap, 'price');
                        $price = (isset($priceVal) && is_numeric($priceVal)) ? (float) $priceVal : 0;

                        $activeVal = $resolve($mapped, $defaultsMap, 'active');
                        $active = isset($activeVal) ? (int) $activeVal : 1;

                        $catVal = $resolve($mapped, $defaultsMap, 'category_products_id');
                        $productCategoryId = (isset($catVal) && is_numeric($catVal)) ? (int) $catVal : 51;

                        if (!in_array($productCategoryId, $validCategoryIds, true)) {
                            $productCategoryId = 51;
                        }

                        $newRow = [
                            'sku' => $sku,
                            'name' => $name,
                            'description' => $description,
                            'img_link' => $imgLink,
                            'price' => $price,
                            'active' => $active,
                            'category_products_id' => $productCategoryId,
                            
                        ];
                    endif;

                    $upsertRows[] = $newRow;
               

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
            // Diagnostic FK avant l'upsert massif
            if (!empty($upsertRows)) {
                $idsToCheck = array_values(array_unique(array_filter(array_map(function ($r) {
                    return $r['category_products_id'] ?? null;
                }, $upsertRows), function ($v) { return $v !== null; })));
                try {
                    $existingIds = DB::table('category_products')->whereIn('id', $idsToCheck)->pluck('id')->all();
                } catch (\Throwable $e) {
                    $existingIds = [];
                    Log::warning('[Import]['.$id.'] Impossible de récupérer les IDs catégories: '.$e->getMessage());
                }
                $missing = array_values(array_diff($idsToCheck, $existingIds));
                // Log::debug('[Import]['.$id.'] Category FK diagnostic', [
                //     'ids_to_check' => $idsToCheck,
                //     'existing' => $existingIds,
                //     'missing' => $missing,
                //     'rows' => count($upsertRows)
                // ]);
            }

            // Upsert par lots de 100 pour éviter les problèmes de contraintes
            if (!empty($upsertRows)) {
                $chunks = array_chunk($upsertRows, 100);
                foreach ($chunks as $chunk) {
                    Product::withoutEvents(function () use ($chunk, $id) {
                        Product::upsert(
                            $chunk,
                            ['sku'],
                            ['name', 'description', 'img_link', 'price', 'active', 'category_products_id']
                        );
                    });
                }
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
            $string = trim($string);
            $slugger = new AsciiSlugger();
            return $slugger->slug($string)->lower()->toString();
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

        // Charger le mapping defaults si disponible pour déterminer la clé SKU
        $state = Cache::get("import:$id", []);
        $dbProductsId = isset($state['db_products_id']) && is_numeric($state['db_products_id'])
            ? (int) $state['db_products_id']
            : null;

        Log::info("[Import][Split][$id] db_products_id from cache: $dbProductsId");

        $defaultsMap = null;
        if ($dbProductsId) {
            try {
                /** @var \App\Models\DbProducts|null $dbp */
                $dbp = \App\Models\DbProducts::find($dbProductsId);
                if ($dbp && is_array($dbp->champs) && !empty($dbp->champs)) {
                    $defaultsMap = $dbp->champs;
                    Log::info("[Import][Split][$id] Loaded defaultsMap", ['map' => $defaultsMap]);
                }
            } catch (\Throwable $e) {
                Log::warning('Unable to load DbProducts defaults in split: ' . $e->getMessage());
            }
        }

        $resolve = function (array $mapped, ?array $defaultsMap, string $targetKey) {
            if (is_array($defaultsMap)) {
                // Mapping inversé: source -> cible
                $sourceKey = array_search($targetKey, $defaultsMap, true);
                if ($sourceKey !== false) {
                    $sourceKey = (string) $sourceKey;
                    if ($sourceKey !== '') {
                        return $mapped[$sourceKey] ?? null;
                    }
                }
            }
            return $mapped[$targetKey] ?? null;
        };

        $lineCount = 0;
        foreach ($reader->getRecords() as $row) {
            $lineCount++;
            $mapped = [];
            foreach ($row as $key => $value) {
                $normalizedKey = $normalizeKey($key);
                $mapped[$normalizedKey] = is_string($value) ? trim($value) : $value;
            }

            if (!$this->rowHasContent($mapped)) {
                Log::info("[Import][Split][$id] Line $lineCount: empty row, skipped");
                continue;
            }

            // Utiliser le mapping pour déterminer la présence d'un SKU
            $skuSource = $resolve($mapped, $defaultsMap, 'sku');
            $sku = trim((string) ($skuSource ?? ''));
            
            if ($lineCount <= 3) {
                Log::info("[Import][Split][$id] Line $lineCount: sku resolved", [
                    'sku_source' => $skuSource,
                    'sku' => $sku,
                    'mapped_keys' => array_keys($mapped)
                ]);
            }
            
            if ($sku === '') {
                Log::info("[Import][Split][$id] Line $lineCount: empty SKU, skipped");
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
