<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use League\Csv\Reader;
use League\Csv\Writer;
use Symfony\Component\String\Slugger\AsciiSlugger;
use Spatie\Permission\Models\Role;

class UserImportService
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
                fputcsv($reportHandle, ['line', 'error', 'email', 'name', 'raw'], ';');
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

                Log::info("User import progress update for ID $id: processed=$processed, errors=$errors, total=$total, completed=$completed");

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

            // Précharger les rôles valides
            static $validRoleIds = null;
            if ($validRoleIds === null) {
                try {
                    $validRoleIds = Role::pluck('id', 'name')->all();
                } catch (\Throwable $e) {
                    Log::warning('[User Import]['.$id.'] Impossible de charger roles: '.$e->getMessage());
                    $validRoleIds = [];
                }
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

                    $email = trim((string) ($mapped['email'] ?? ''));
                    $name = trim((string) ($mapped['name'] ?? ''));
                    $password = trim((string) ($mapped['password'] ?? null));
                    $roles = trim((string) ($mapped['roles'] ?? ''));

                    $currentSnapshot = [
                        'line' => $processed + $errors + 1,
                        'email' => $email !== '' ? $email : null,
                        'name' => $name !== '' ? $name : null,
                    ];

                    if ($email === '' || $name === '') {
                        $errors++;
                        $this->writeReportLine($reportHandle, $processed + $errors, 'Missing email or name', $row, $mapped);
                        $updateProgress($currentSnapshot);
                        $currentIndex++;
                        continue;
                    }

                    // Validation email
                    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        $errors++;
                        $this->writeReportLine($reportHandle, $processed + $errors, 'Invalid email format', $row, $mapped);
                        $updateProgress($currentSnapshot);
                        $currentIndex++;
                        continue;
                    }

                    $upsertRows[] = [
                        'email' => $email,
                        'name' => $name,
                        'password' => $password,
                        'roles' => $roles,
                        'email_verified_at' => now(),
                    ];

                    $processed++;

                    if (count($upsertRows) >= 100) {
                        $this->batchUpsertUsers($upsertRows, $validRoleIds);
                        $upsertRows = [];
                        $updateProgress($currentSnapshot);
                    }

                    $updateProgress($currentSnapshot);

                } catch (\Throwable $e) {
                    $errors++;
                    Log::warning("[User Import][$id] Error processing row $currentIndex: " . $e->getMessage());
                    $this->writeReportLine($reportHandle, $processed + $errors, $e->getMessage(), $row, $mapped);
                    $currentSnapshot = [
                        'line' => $processed + $errors,
                        'email' => $mapped['email'] ?? null,
                        'name' => $mapped['name'] ?? null,
                    ];
                    $updateProgress($currentSnapshot);
                }

                $currentIndex++;
            }

            // Dernière batch
            if (!empty($upsertRows)) {
                $this->batchUpsertUsers($upsertRows, $validRoleIds);
            }

            if ($reportHandle) {
                fclose($reportHandle);
            }

            // Vérifier s'il y a d'autres chunks
            $nextChunk = $chunkIndex + 1;
            $nextDataFile = $tempDir . DIRECTORY_SEPARATOR . 'data_' . $nextChunk . '.csv';
            $hasMore = is_file($nextDataFile);

            $finalState = [
                'status' => $cancelled ? 'cancelled' : ($hasMore ? 'processing' : 'done'),
                'processed' => $processed,
                'total' => $total,
                'errors' => $errors,
                'progress' => $total > 0 ? (int) floor((($processed + $errors) / $total) * 100) : 100,
                'next_offset' => $nextChunk,
                'has_more' => $hasMore,
                'path' => $relativePath,
            ];

            // Ajouter l'URL du rapport s'il y a des erreurs
            if ($errors > 0 && Storage::exists('imports/reports/' . $id . '.csv')) {
                $finalState['report'] = route('users.import.report', ['id' => $id]);
            }

            $this->updateImportState($id, $finalState);

            // Nettoyer les fichiers temporaires si complète
            if (!$hasMore) {
                $this->cleanupTempChunks($id);
            }

        } catch (\Throwable $e) {
            Log::error("[User Import][$id] Fatal error in chunk $chunkIndex: " . $e->getMessage());

            $this->updateImportState($id, [
                'status' => 'error',
                'error_message' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Découper le CSV source en fichiers temporaires.
     */
    private function splitIntoTempFiles(string $id, string $fullPath, int $limit = 4000): void
    {
        $tempDir = Storage::path('imports/tmp/' . $id);
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $reader = Reader::from($fullPath, 'r');
        $reader->setDelimiter(';');
        $reader->setHeaderOffset(0);

        $headers = $reader->getHeader();
        $records = iterator_to_array($reader->getRecords());
        $total = count($records);

        $this->updateImportState($id, [
            'status' => 'processing',
            'total' => $total,
            'processed' => 0,
            'errors' => 0,
            'progress' => 0,
        ]);

        $chunkIndex = 0;
        $currentChunk = [];

        foreach ($records as $offset => $record) {
            $currentChunk[] = $record;

            if (count($currentChunk) >= $limit || $offset === count($records) - 1) {
                // Écrire le chunk
                $chunkFile = $tempDir . DIRECTORY_SEPARATOR . 'data_' . $chunkIndex . '.csv';
                $writer = Writer::createFromPath($chunkFile, 'w');
                $writer->setDelimiter(';');
                $writer->insertOne($headers);
                $writer->insertAll($currentChunk);

                $currentChunk = [];
                $chunkIndex++;
            }
        }
    }

    /**
     * Traiter un lot d'utilisateurs (upsert par email).
     */
    private function batchUpsertUsers(array $rows, array $validRoleIds): void
    {
        foreach ($rows as $row) {
            try {
                $email = $row['email'];
                $name = $row['name'];
                $password = $row['password'];
                $rolesStr = $row['roles'];

                // Upsert utilisateur
                $user = User::updateOrCreate(
                    ['email' => $email],
                    [
                        'name' => $name,
                        'email_verified_at' => now(),
                    ]
                );

                // Si nouveau user et password fourni, updater le password
                if ($password && $user->wasRecentlyCreated) {
                    $user->update(['password' => bcrypt($password)]);
                }

                // Assigner les rôles
                if (!empty($rolesStr)) {
                    $roleNames = array_map('trim', explode('|', $rolesStr));
                    $validRoleNames = [];
                    foreach ($roleNames as $roleName) {
                        if (isset($validRoleIds[$roleName])) {
                            $validRoleNames[] = $roleName;
                        }
                    }
                    if (!empty($validRoleNames)) {
                        $user->syncRoles($validRoleNames);
                    }
                }

            } catch (\Throwable $e) {
                Log::warning("[User Import] Error upserting user {$row['email']}: " . $e->getMessage());
            }
        }
    }

    /**
     * Mapper une ligne CSV selon la clé normalisée.
     */
    private function mapRow(array $row, array $keyMap, callable $normalizeKey): array
    {
        $mapped = [];
        foreach ($row as $originalKey => $value) {
            $normalizedKey = $keyMap[$originalKey] ?? $normalizeKey($originalKey);
            $mapped[$normalizedKey] = $value;
        }
        return $mapped;
    }

    /**
     * Vérifier si une ligne a du contenu.
     */
    private function rowHasContent(array $mapped): bool
    {
        foreach ($mapped as $value) {
            if ($value !== null && trim((string) $value) !== '') {
                return true;
            }
        }
        return false;
    }

    /**
     * Écrire une ligne d'erreur dans le rapport.
     */
    private function writeReportLine($handle, int $line, string $error, array $row, array $mapped): void
    {
        if ($handle) {
            $email = $mapped['email'] ?? $row['email'] ?? '';
            $name = $mapped['name'] ?? $row['name'] ?? '';
            $rawJson = json_encode($row);
            fputcsv($handle, [$line, $error, $email, $name, $rawJson], ';');
        }
    }

    /**
     * Mettre à jour l'état de l'import en cache.
     */
    private function updateImportState(string $id, array $state): void
    {
        $current = Cache::get("import:$id", []);
        $merged = array_merge($current, $state);
        Cache::put("import:$id", $merged, now()->addHour());
    }

    /**
     * Nettoyer les fichiers temporaires.
     */
    private function cleanupTempChunks(string $id): void
    {
        // Use Storage to delete recursively (handles subdirs/files safely)
        Storage::deleteDirectory('imports/tmp/' . $id);
    }
}
