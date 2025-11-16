<?php

namespace App\Jobs;

use App\Models\Product;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use League\Csv\Reader;
use Illuminate\Support\Facades\Storage;

class ImportProductsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected string $importId;
    protected string $path;

    /**
     * Crée une nouvelle instance du job.
     */
    public function __construct(string $importId, string $path)
    {
        $this->importId = $importId;
        $this->path = $path;
    }

    /**
     * Exécute le job d'import.
     */
    public function handle(): void
    {
        $id = $this->importId;
        $path = $this->path;

        $state = Cache::get("import:$id");
        $relativePath = is_array($state) && isset($state['path']) && is_string($state['path'])
            ? $state['path']
            : null;

        try {
            // Initialisation du cache
            Cache::put("import:$id", [
                'status' => 'processing',
                'processed' => 0,
                'total' => 0,
                'errors' => 0,
                'current' => null,
                'path' => $relativePath ?? $path,
            ], now()->addHour());

            // Lecture via League CSV avec séparateur ';'
            $fullPath = $path;
            if (!is_string($fullPath) || !is_file($fullPath)) {
                throw new \RuntimeException("Fichier introuvable: " . (string)$fullPath);
            }

            // 1) Comptage des lignes valides (non vides + SKU non vide)
            $csv = Reader::from($fullPath, 'r');
            $csv->setDelimiter(';');
            $csv->setHeaderOffset(0);
            $origHeader = $csv->getHeader();
            $normalizeKey = function ($s) {
                $s = (string)$s;
                $s = preg_replace('/^\xEF\xBB\xBF/', '', $s);
                return mb_strtolower(trim($s));
            };
            $keyMap = [];
            foreach ($origHeader as $h) { $keyMap[$h] = $normalizeKey($h); }

            $total = 0;
            foreach ($csv->getRecords() as $row) {
                // normalise clés/valeurs
                $map = [];
                foreach ($row as $k => $v) {
                    $nk = $keyMap[$k] ?? $normalizeKey($k);
                    if (is_string($v)) {
                        $vv = trim($v);
                        $map[$nk] = ($vv === '') ? null : $vv;
                    } else {
                        $map[$nk] = $v;
                    }
                }
                // skip totalement vide
                $hasValue = false;
                foreach ($map as $v) { if ($v !== null && $v !== '') { $hasValue = true; break; } }
                if (!$hasValue) continue;
                $sku = trim((string)($map['sku'] ?? ''));
                if ($sku === '') continue;
                $total++;
            }

            $processed = 0;
            $errors = 0;
            Cache::put("import:$id", [
                'status' => 'processing',
                'processed' => 0,
                'total' => $total,
                'errors' => 0,
                'path' => $relativePath ?? $path,
            ], now()->addHour());

            // 2) Traitement effectif (nouveau Reader pour repartir du début)
            $csv = Reader::from($fullPath, 'r');
            $csv->setDelimiter(';');
            $csv->setHeaderOffset(0);
            $origHeader = $csv->getHeader();
            $keyMap = [];
            foreach ($origHeader as $h) { $keyMap[$h] = $normalizeKey($h); }

            // Prépare le rapport d'erreurs
            Storage::makeDirectory('imports/reports');
            $reportPath = Storage::path('imports/reports/' . $id . '.csv');
            $reportHandle = fopen($reportPath, 'w');
            if ($reportHandle) {
                fputcsv($reportHandle, ['line', 'error', 'sku', 'name', 'raw'], ';');
            }

            $cancelled = false;
            foreach ($csv->getRecords() as $row) {
                // Annulation demandée ?
                if (Cache::get("import:$id:cancel", false)) {
                    $cancelled = true;
                    break;
                }

                try {
                    // normalise clés/valeurs
                    $map = [];
                    foreach ($row as $k => $v) {
                        $nk = $keyMap[$k] ?? $normalizeKey($k);
                        if (is_string($v)) {
                            $vv = trim($v);
                            $map[$nk] = ($vv === '') ? null : $vv;
                        } else {
                            $map[$nk] = $v;
                        }
                    }

                    // skip empty
                    $hasValue = false;
                    foreach ($map as $v) { if ($v !== null && $v !== '') { $hasValue = true; break; } }
                    if (!$hasValue) continue;

                    $sku = trim((string)($map['sku'] ?? ''));
                    $name = trim((string)($map['name'] ?? ''));
                    if ($sku === '' || $name === '') {
                        $errors++;
                        if ($reportHandle) {
                            fputcsv($reportHandle, [
                                $processed + 1,
                                'Missing sku or name',
                                $map['sku'] ?? null,
                                $map['name'] ?? null,
                                is_array($row) ? implode('|', array_values($row)) : '',
                            ], ';');
                        }
                        continue;
                    }

                    $description = isset($map['description']) ? trim((string)$map['description']) : null;
                    $imgLink = isset($map['img_link']) ? trim((string)$map['img_link']) : null;
                    $price = isset($map['price']) && is_numeric($map['price']) ? (float)$map['price'] : 0;
                    $active = isset($map['active']) ? (int)$map['active'] : 1;

                    Product::updateOrCreate(
                        ['sku' => $sku],
                        [
                            'name' => $name,
                            'description' => $description,
                            'img_link' => $imgLink,
                            'price' => $price,
                            'active' => $active,
                        ]
                    );

                    $processed++;
                } catch (\Throwable $e) {
                    $errors++;
                    Log::error("Erreur import: " . $e->getMessage());
                    if ($reportHandle) {
                        fputcsv($reportHandle, [
                            $processed + 1,
                            $e->getMessage(),
                            $map['sku'] ?? null,
                            $map['name'] ?? null,
                            is_array($row) ? implode('|', array_values($row)) : '',
                        ], ';');
                    }
                }

                // Mettre à jour la progression périodiquement
                if ($total > 0 && ($processed % 20 === 0 || $processed === $total)) {
                    $pct = (int) floor(($processed / max(1, $total)) * 100);
                    Cache::put("import:$id", [
                        'status' => 'processing',
                        'processed' => $processed,
                        'total' => $total,
                        'errors' => $errors,
                        'progress' => $pct,
                        'current' => [
                            'line' => $processed,
                            'sku' => $map['sku'] ?? null,
                            'name' => $map['name'] ?? null,
                        ],
                        'path' => $relativePath ?? $path,
                    ], now()->addHour());
                }
            }

            // Fermeture du rapport (et suppression si aucune erreur)
            if (isset($reportHandle) && $reportHandle) {
                fclose($reportHandle);
                if ($errors === 0 && file_exists($reportPath)) {
                    @unlink($reportPath);
                }
            }

            // Archivage/suppression du CSV source
            try {
                $archiveDir = Storage::path('imports/archive');
                if (!is_dir($archiveDir)) @mkdir($archiveDir, 0777, true);
                $dest = $archiveDir . DIRECTORY_SEPARATOR . basename($fullPath);
                if (app()->isLocal()) {
                    @rename($fullPath, $dest);
                } else {
                    @unlink($fullPath);
                }
            } catch (\Throwable $t) {
                Log::warning('Import cleanup error (job): ' . $t->getMessage());
            }

            // Finalisation
            if (!empty($cancelled)) {
                Cache::put("import:$id", [
                    'status' => 'cancelled',
                    'processed' => $processed,
                    'total' => $total,
                    'errors' => $errors,
                    'progress' => (int) floor(($processed / max(1, $total)) * 100),
                    'report' => (isset($reportPath) && file_exists($reportPath) ? route('products.import.report', ['id' => $id]) : null),
                    'path' => $relativePath ?? $path,
                ], now()->addHour());
            } else {
                Cache::put("import:$id", [
                    'status' => 'done',
                    'processed' => $processed,
                    'total' => $total,
                    'errors' => $errors,
                    'progress' => 100,
                    'report' => ($errors > 0 && isset($reportPath) && file_exists($reportPath) ? route('products.import.report', ['id' => $id]) : null),
                    'path' => $relativePath ?? $path,
                ], now()->addHour());
            }

        } catch (\Throwable $e) {
            Log::error("ImportProductsJob failed for $id: " . $e->getMessage());
            Cache::put("import:$id", [
                'status' => 'error',
                'message' => $e->getMessage(),
                'path' => $relativePath ?? $path,
            ], now()->addHour());
        }
    }
}
