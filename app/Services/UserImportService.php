<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use League\Csv\Reader;
use League\Csv\Writer;
use Symfony\Component\String\Slugger\AsciiSlugger;
use Spatie\Permission\Models\Role;

use function Illuminate\Log\log;

class UserImportService
{
    public function run(string $id, string $fullPath, string $relativePath, int $limit = 100): void
    {
        // Augmenter la limite de temps pour les imports volumineux
        // set_time_limit(300); // 5 minutes
        
        // Première étape : découper le fichier CSV source en fichiers temporaires de données
        $this->splitIntoTempFiles($id, $fullPath, $limit);
        // Ne pas traiter le premier chunk ici pour permettre au polling de piloter les chunks
        // Le contrôleur initialisera next_offset et has_more et le front déclenchera processChunk
    }

    public function runChunk(string $id, string $relativePath, int $chunkIndex): void
    {
        // Réinitialiser la limite de temps pour chaque chunk
        // set_time_limit(300);
        
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

            // Si un chunk 0 a plante avant finalisation (next_offset reste a 0),
            // repartir d'un compteur propre pour eviter processed > total au retry.
            if ($chunkIndex === 0 && ((int) ($state['next_offset'] ?? 0)) === 0 && ($processed > 0 || $errors > 0)) {
                $processed = 0;
                $errors = 0;
                $this->updateImportState($id, [
                    'processed' => 0,
                    'errors' => 0,
                    'progress' => 0,
                ]);
            }

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

                // Limiter les writes cache/log pour accelerer l'import.
                if ($completed % 200 !== 0 && $completed !== $total) {
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

            // Récupérer la stratégie d'import
            $strategy = $state['strategy'] ?? 'basique';

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

                    // Traitement différent selon la stratégie
                    if ($strategy === 'old_DB') {
                        // Ancienne base de données: colonnes nom, mail (multiple séparés par ;), pass
                        $name = trim((string) ($mapped['nom'] ?? ''));
                        $mailField = trim((string) ($mapped['mail'] ?? ''));
                        $passwordRaw = trim((string) ($mapped['pass'] ?? ''));
                        $expediteursRaw = $mapped['expediteurs'] ?? null;
                        
                        // Extraire le premier email de la liste séparée par ;
                        $emails = array_filter(array_map('trim', explode(';', $mailField)));
                        $email = !empty($emails) ? $emails[0] : '';
                        
                        $password = $passwordRaw; // Sera haché dans batchUpsertUsers
                        $roles = trim((string) ($mapped['type'] ?? ''));
                        switch (strtolower($roles)) {
                            case 'administrateur': $roles = 'admin'; break;
                            case 'client': $roles = 'client'; break; 
                            case 'commercial': $roles = 'commercial'; break;
                            default: $roles = 'guest'; break;
                        }

                        $dbProductsSync = $this->buildDbProductsSyncFromExpediteurs($expediteursRaw);

                        // Mapping old_db.csv -> users
                        $phone = trim((string) ($mapped['tel'] ?? ''));
                        $addressRoad = trim((string) ($mapped['rue'] ?? ''));
                        $addressZip = trim((string) ($mapped['zip'] ?? ''));
                        $addressTown = trim((string) ($mapped['ville'] ?? ''));
                        $ref = trim((string) ($mapped['alias'] ?? ''));   // alias CSV -> ref users
                        $alias = trim((string) ($mapped['login'] ?? '')); // login CSV -> alias users

                        // Conserver la hiérarchie nested set
                        // Stockage de l'old_id pour mapper les parent_id plus tard
                        // $lft = !empty($mapped['lft']) ? (int)$mapped['lft'] : 0;
                        // $rgt = !empty($mapped['rgt']) ? (int)$mapped['rgt'] : 0;
                        
                    } else {
                        // Import basique standard
                        $email = trim((string) ($mapped['email'] ?? ''));
                        $name = trim((string) ($mapped['name'] ?? ''));
                        $password = trim((string) ($mapped['password'] ?? null));
                        $roles = trim((string) ($mapped['roles'] ?? ''));
                        $dbProductsSync = [];
                        $phone = null;
                        $addressRoad = null;
                        $addressZip = null;
                        $addressTown = null;
                        $ref = null;
                        $alias = null;
                        // $lft = 0;
                        // $rgt = 0;
                    }

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
                        'db_products_sync' => $dbProductsSync,
                        'phone' => $phone !== '' ? $phone : null,
                        'address_road' => $addressRoad !== '' ? $addressRoad : null,
                        'address_zip' => $addressZip !== '' ? $addressZip : null,
                        'address_town' => $addressTown !== '' ? $addressTown : null,
                        'ref' => $ref !== '' ? $ref : null,
                        'alias' => $alias !== '' ? $alias : null,
                        'email_verified_at' => now(),
                        // '_lft' => $lft,
                        // '_rgt' => $rgt,
                        // 'parent_id' => null,  // À corriger après le mapping
                    ];

                    $processed++;

                    if (count($upsertRows) >= 300) {
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
                        'email' => $mapped['email'] ?? $mapped['mail'] ?? null,
                        'name' => $mapped['name'] ?? $mapped['nom'] ?? null,
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

            $completed = min($total, max(0, $processed + $errors));
            $finalProgress = $total > 0 ? (int) ceil(($completed / $total) * 100) : 100;
            $finalProgress = min(100, max(0, $finalProgress));

            $finalState = [
                'status' => $cancelled ? 'cancelled' : ($hasMore ? 'processing' : 'done'),
                'processed' => min($processed, $total > 0 ? $total : $processed),
                'total' => $total,
                'errors' => min($errors, $total > 0 ? $total : $errors),
                'progress' => $hasMore ? $finalProgress : 100,
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
                // Correction des parent_id pour la stratégie old_DB
                if ($strategy === 'old_DB') {
                    // calculer le nouvel arbre nested set
                }
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
        if (empty($rows)) {
            return;
        }

        $now = now();
        $userUpserts = [];
        $emails = [];
        $rolesByEmail = [];
        $dbProductsByEmail = [];

        $existingUsersByEmail = User::query()
            ->select(['id', 'email', 'password'])
            ->whereIn('email', array_values(array_unique(array_map(static fn ($r) => (string) ($r['email'] ?? ''), $rows))))
            ->get()
            ->keyBy('email');

        // Hash par defaut calcule une seule fois pour limiter fortement le cout CPU.
        $defaultHashedPassword = $this->hashPasswordForImport(Str::random(40));

        foreach ($rows as $row) {
            $email = (string) ($row['email'] ?? '');
            if ($email === '') {
                continue;
            }

            $emails[$email] = true;

            $plainPassword = trim((string) ($row['password'] ?? ''));
            $existing = $existingUsersByEmail->get($email);

            if ($plainPassword !== '') {
                // Eviter de re-hasher si la valeur importee semble deja bcrypt.
                $hashedPassword = str_starts_with($plainPassword, '$2y$')
                    ? $plainPassword
                    : $this->hashPasswordForImport($plainPassword);
            } else {
                // Conserver le hash existant si present, sinon hash par defaut pre-calcule.
                $hashedPassword = $existing?->password ?: $defaultHashedPassword;
            }

            $userUpserts[] = [
                'email' => $email,
                'name' => (string) ($row['name'] ?? ''),
                'password' => $hashedPassword,
                'alias' => $row['alias'] ?? null,
                'ref' => $row['ref'] ?? null,
                'phone' => $row['phone'] ?? null,
                'address_road' => $row['address_road'] ?? null,
                'address_zip' => $row['address_zip'] ?? null,
                'address_town' => $row['address_town'] ?? null,
                'email_verified_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $rolesStr = trim((string) ($row['roles'] ?? ''));
            if ($rolesStr !== '') {
                $validRoleNames = [];
                foreach (array_map('trim', explode('|', $rolesStr)) as $roleName) {
                    if ($roleName !== '' && isset($validRoleIds[$roleName])) {
                        $validRoleNames[$roleName] = true;
                    }
                }
                if (!empty($validRoleNames)) {
                    $rolesByEmail[$email] = array_keys($validRoleNames);
                }
            }

            $dbProductsSync = $row['db_products_sync'] ?? [];
            if (is_array($dbProductsSync) && !empty($dbProductsSync)) {
                foreach ($dbProductsSync as $dbProductId => $pivotAttributes) {
                    $dbProductId = (int) $dbProductId;
                    if ($dbProductId <= 0) {
                        continue;
                    }

                    $attributes = null;
                    if (is_array($pivotAttributes)) {
                        $attributes = $pivotAttributes['attributes'] ?? null;
                    }

                    $dbProductsByEmail[$email][$dbProductId] = [
                        'db_product_id' => $dbProductId,
                        'attributes' => $attributes,
                    ];
                }
            }
        }

        if (empty($userUpserts)) {
            return;
        }

        try {
            DB::transaction(function () use ($userUpserts, $emails, $rolesByEmail, $validRoleIds, $dbProductsByEmail, $now) {
                User::upsert(
                    $userUpserts,
                    ['email'],
                    ['name', 'password', 'alias', 'ref', 'phone', 'address_road', 'address_zip', 'address_town', 'email_verified_at', 'updated_at']
                );

                $usersByEmail = User::query()
                    ->select(['id', 'email'])
                    ->whereIn('email', array_keys($emails))
                    ->get()
                    ->keyBy('email');

                if (!empty($rolesByEmail)) {
                    $roleSyncUserIds = [];
                    $rolePivotRows = [];

                    foreach ($rolesByEmail as $email => $roleNames) {
                        $user = $usersByEmail->get($email);
                        if (!$user) {
                            continue;
                        }

                        $roleSyncUserIds[] = $user->id;

                        foreach ($roleNames as $roleName) {
                            $rolePivotRows[] = [
                                'role_id' => (int) $validRoleIds[$roleName],
                                'model_type' => User::class,
                                'model_id' => (int) $user->id,
                            ];
                        }
                    }

                    if (!empty($roleSyncUserIds)) {
                        DB::table('model_has_roles')
                            ->where('model_type', User::class)
                            ->whereIn('model_id', array_values(array_unique($roleSyncUserIds)))
                            ->delete();

                        if (!empty($rolePivotRows)) {
                            DB::table('model_has_roles')->insert($rolePivotRows);
                        }
                    }
                }

                if (!empty($dbProductsByEmail)) {
                    $pivotRows = [];

                    foreach ($dbProductsByEmail as $email => $links) {
                        $user = $usersByEmail->get($email);
                        if (!$user) {
                            continue;
                        }

                        foreach ($links as $link) {
                            $pivotRows[] = [
                                'user_id' => (int) $user->id,
                                'db_product_id' => (int) $link['db_product_id'],
                                'attributes' => $link['attributes'],
                                'created_at' => $now,
                                'updated_at' => $now,
                            ];
                        }
                    }

                    if (!empty($pivotRows)) {
                        DB::table('db_products_users')->upsert(
                            $pivotRows,
                            ['user_id', 'db_product_id'],
                            ['attributes', 'updated_at']
                        );
                    }
                }
            }, 3);
        } catch (\Throwable $e) {
            Log::warning('[User Import] Batch upsert failed: ' . $e->getMessage());

            // Fallback robuste en cas d'echec transactionnel.
            foreach ($rows as $row) {
                try {
                    $email = $row['email'];
                    $name = $row['name'];
                    $password = $row['password'];
                    $rolesStr = $row['roles'];
                    $dbProductsSync = $row['db_products_sync'] ?? [];

                    $hashedPassword = !empty($password)
                        ? (str_starts_with((string) $password, '$2y$')
                            ? (string) $password
                            : $this->hashPasswordForImport((string) $password))
                        : $this->hashPasswordForImport(Str::random(32));

                    $user = User::updateOrCreate(
                        ['email' => $email],
                        [
                            'name' => $name,
                            'password' => $hashedPassword,
                            'alias' => $row['alias'] ?? null,
                            'ref' => $row['ref'] ?? null,
                            'phone' => $row['phone'] ?? null,
                            'address_road' => $row['address_road'] ?? null,
                            'address_zip' => $row['address_zip'] ?? null,
                            'address_town' => $row['address_town'] ?? null,
                            'email_verified_at' => now(),
                        ]
                    );

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

                    if (!empty($dbProductsSync)) {
                        $user->dbProducts()->sync($dbProductsSync, false);
                    }
                } catch (\Throwable $inner) {
                    Log::warning("[User Import] Error upserting user {$row['email']}: " . $inner->getMessage());
                }
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
     * Préparer le sync des db_products depuis la colonne expediteurs (JSON).
     */
    private function buildDbProductsSyncFromExpediteurs($raw): array
    {
        if ($raw === null || $raw === '') {
            return [];
        }

        $decoded = is_array($raw) ? $raw : json_decode((string) $raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $sync = [];

        foreach ($decoded as $key => $value) {
            $sourceId = null;
            $attributes = [];

            if (is_array($value)) {
                $attributes = $value;
                if (is_numeric($key)) {
                    $sourceId = (int) $key;
                }
                if ($sourceId === null && isset($value['id'])) {
                    $sourceId = (int) $value['id'];
                }
                if ($sourceId === null && isset($value['db_product_id'])) {
                    $sourceId = (int) $value['db_product_id'];
                }
                if ($sourceId === null && isset($value['db_id'])) {
                    $sourceId = (int) $value['db_id'];
                }
            } else {
                if (is_numeric($key)) {
                    $sourceId = (int) $key;
                    $attributes = ['value' => $value];
                }
            }

            $mappedId = $this->mapLegacyDbProductId($sourceId);
            if ($mappedId === null) {
                continue;
            }

            unset($attributes['id'], $attributes['db_product_id'], $attributes['db_id']);

            if (isset($attributes['c']) && $attributes['c'] === 'x') {
                $attributes['c'] = 'admin';
            }

            if (array_key_exists('p', $attributes)) {
                $pValue = is_numeric($attributes['p']) ? (int) $attributes['p'] : $attributes['p'];
                if ($pValue === 0) {
                    $attributes['p'] = 1;
                } elseif ($pValue === -1) {
                    $attributes['p'] = 0;
                }
            }

            if (isset($sync[$mappedId]['attributes'])) {
                $existing = json_decode($sync[$mappedId]['attributes'], true);
                $merged = is_array($existing) ? array_merge($existing, $attributes) : $attributes;
                $sync[$mappedId]['attributes'] = json_encode($merged);
            } else {
                $sync[$mappedId] = ['attributes' => json_encode($attributes)];
            }
        }

        return $sync;
    }

    /**
     * Mapper les ids legacy d'expediteurs vers db_products.
     */
    private function mapLegacyDbProductId($sourceId): ?int
    {
        if ($sourceId === null) {
            return null;
        }

        $sourceId = (int) $sourceId;

        if ($sourceId === 2) {
            return 4; // peplant
        }

        if ($sourceId === 3) {
            return 5; // ddk
        }

        if ($sourceId === 12 || $sourceId === 13) {
            return 3; // eurofleurs
        }

        return null;
    }

    /**
     * Hash de mot de passe optimise pour les imports massifs.
     */
    private function hashPasswordForImport(string $plain): string
    {
        $rounds = (int) env('IMPORT_BCRYPT_ROUNDS', 8);
        $rounds = max(4, min(12, $rounds));

        return password_hash($plain, PASSWORD_BCRYPT, ['cost' => $rounds]);
    }

    /**
     * Mettre à jour l'état de l'import en cache.
     */
    private function updateImportState(string $id, array $state): void
    {
        $current = Cache::get("import:$id", []);
        $merged = array_merge($current, $state);
        Log::info("maj progress");
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
