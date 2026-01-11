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
    /**
     * Lance l'import complet (découpe le CSV en chunks puis traite le premier).
     */
    public function run(string $id, string $fullPath, string $relativePath, int $limit = 4000): void
    {
        // Augmenter la limite de temps pour les imports volumineux
        set_time_limit(300); // 5 minutes

        // Première étape : découper le fichier CSV source en fichiers temporaires de données
        $this->splitIntoTempFiles($id, $fullPath, $limit);

        // Lancer le premier chunk
        $this->runChunk($id, $relativePath, 0);
    }

    /**
     * Traite un chunk de données.
     */
    public function runChunk(string $id, string $relativePath, int $chunkIndex): void
    {
        // Réinitialiser la limite de temps pour chaque chunk
        set_time_limit(300);

        try {
            $normalizeKey = function ($value): string {
                $string = (string) $value;
                $string = preg_replace('/^\xEF\xBB\xBF/', '', $string);
                $string = trim($string);
                $slugger = new AsciiSlugger();
                return $slugger->slug($string)->lower()->toString();
            };

            // État global de l'import
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

            // Fichier de rapport d'erreurs
            Storage::makeDirectory('imports/reports');
            $reportPath = Storage::path('imports/reports/' . $id . '.csv');
            $reportHandle = fopen($reportPath, file_exists($reportPath) ? 'a' : 'w');
            if ($reportHandle && !filesize($reportPath)) {
                fputcsv($reportHandle, ['line', 'error', 'email', 'name', 'raw'], ';');
            }

            // Lecture du chunk
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
                    'status'    => 'processing',
                    'processed' => $processed,
                    'total'     => $total,
                    'errors'    => $errors,
                    'progress'  => (int) floor(($completed / max(1, $total)) * 100),
                    'current'   => $current,
                    'path'      => $relativePath,
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
                    Log::warning('[User Import][' . $id . '] Impossible de charger roles: ' . $e->getMessage());
                    $validRoleIds = [];
                }
            }

            // Récupérer la stratégie d'import
            $strategy = $state['strategy'] ?? 'basique';

            // Arbre de l'ancien CSV en cache (uniquement pour old_DB)
            $tree = [];
            if ($strategy === 'old_DB') {
                $tree = Cache::get("import:$id:tree", []);
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

                    // Valeurs par défaut
                    $email = '';
                    $name = '';
                    $password = null;
                    $roles = '';
                    $lft = 0;
                    $rgt = 0;

                    // Traitement différent selon la stratégie
                    if ($strategy === 'old_DB') {
                        /**
                         * Ancienne base de données (ex: vegetal_user_extrait.csv)
                         * Colonnes: id_user, parent, nom, prenom, mail (plusieurs emails séparés par ;), pass, type, ...
                         */

                        // Nom complet éventuel : prenom + nom
                        $lastName = trim((string) ($mapped['nom'] ?? ''));
                        $firstName = trim((string) ($mapped['prenom'] ?? ''));
                        $name = trim($firstName . ' ' . $lastName);
                        if ($name === '') {
                            $name = $lastName;
                        }

                        $mailField = trim((string) ($mapped['mail'] ?? ''));
                        $passwordRaw = trim((string) ($mapped['pass'] ?? ''));

                        // Extraire le premier email de la liste séparée par ;
                        $emails = array_filter(array_map('trim', explode(';', $mailField)));
                        $email = !empty($emails) ? $emails[0] : '';

                        $password = $passwordRaw; // Sera haché dans batchUpsertUsers

                        $roles = trim((string) ($mapped['type'] ?? ''));
                        switch (strtolower($roles)) {
                            case 'administrateur':
                                $roles = 'admin';
                                break;
                            case 'client':
                                $roles = 'client';
                                break;
                            case 'commercial':
                                $roles = 'commercial';
                                break;
                            default:
                                $roles = 'guest';
                                break;
                        }

                        // On ignore les anciens lft/rgt, ils seront recalculés via User::fixTree()

                        // IDs de l'ancien CSV (d'après les colonnes id_user et parent)
                        $oldId = null;
                        if (isset($mapped['id-user']) && $mapped['id-user'] !== '') {
                            $oldId = (int) $mapped['id-user'];
                        }

                        $oldParentId = null;
                        if (isset($mapped['parent']) && $mapped['parent'] !== '') {
                            $oldParentId = (int) $mapped['parent'];
                            if ($oldParentId === 0) {
                                $oldParentId = null;
                            }
                        }

                        // Stocker la structure de l'arbre en cache (en mémoire uniquement)
                        if (!is_null($oldId)) {
                            $tree[$oldId] = [
                                'old_id'        => $oldId,
                                'parent_old_id' => $oldParentId,
                                'email'         => $email,
                            ];
                        }
                    } else {
                        // Import basique standard
                        $email = trim((string) ($mapped['email'] ?? ''));
                        $name = trim((string) ($mapped['name'] ?? ''));
                        $password = trim((string) ($mapped['password'] ?? null));
                        $roles = trim((string) ($mapped['roles'] ?? ''));
                        $lft = 0;
                        $rgt = 0;
                    }

                    $currentSnapshot = [
                        'line'  => $processed + $errors + 1,
                        'email' => $email !== '' ? $email : null,
                        'name'  => $name !== '' ? $name : null,
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
                        'email'             => $email,
                        'name'              => $name,
                        'password'          => $password,
                        'roles'             => $roles,
                        'email_verified_at' => now(),
                        '_lft'              => $lft,
                        '_rgt'              => $rgt,
                        'parent_id'         => null, // sera fixé en fin d'import pour old_DB
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
                        'line'  => $processed + $errors,
                        'email' => $mapped['email'] ?? $mapped['mail'] ?? null,
                        'name'  => $mapped['name'] ?? $mapped['nom'] ?? null,
                    ];
                    $updateProgress($currentSnapshot);
                }

                $currentIndex++;
            }

            // Sauvegarder l'arbre en cache pour la stratégie old_DB
            if ($strategy === 'old_DB') {
                Cache::put("import:$id:tree", $tree, now()->addHour());
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
                'status'      => $cancelled ? 'cancelled' : ($hasMore ? 'processing' : 'done'),
                'processed'   => $processed,
                'total'       => $total,
                'errors'      => $errors,
                'progress'    => $total > 0 ? (int) floor((($processed + $errors) / $total) * 100) : 100,
                'next_offset' => $nextChunk,
                'has_more'    => $hasMore,
                'path'        => $relativePath,
            ];

            // Ajouter l'URL du rapport s'il y a des erreurs
            if ($errors > 0 && Storage::exists('imports/reports/' . $id . '.csv')) {
                $finalState['report'] = route('users.import.report', ['id' => $id]);
            }

            $this->updateImportState($id, $finalState);

            // Si plus de chunks : accrocher la branche old_DB et nettoyer
            if (!$hasMore) {
                if ($strategy === 'old_DB') {
                    $this->attachImportedTreeAsBranch($id);
                }

                $this->cleanupTempChunks($id);
            }
        } catch (\Throwable $e) {
            Log::error("[User Import][$id] Fatal error in chunk $chunkIndex: " . $e->getMessage());

            $this->updateImportState($id, [
                'status'        => 'error',
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
            'status'    => 'processing',
            'total'     => $total,
            'processed' => 0,
            'errors'    => 0,
            'progress'  => 0,
        ]);

        $chunkIndex = 0;
        $currentChunk = [];

        foreach ($records as $offset => $record) {
            $currentChunk[] = $record;

            if (count($currentChunk) >= $limit || $offset === count($records) - 1) {
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
                $lft = $row['_lft'] ?? 0;
                $rgt = $row['_rgt'] ?? 0;
                $parentId = $row['parent_id'] ?? null;

                // Préparer le password haché (générer un aléatoire si vide)
                $hashedPassword = !empty($password)
                    ? bcrypt($password)
                    : bcrypt(\Illuminate\Support\Str::random(32));

                // Upsert utilisateur
                $user = User::updateOrCreate(
                    ['email' => $email],
                    [
                        'name'              => $name,
                        'password'          => $hashedPassword,
                        'email_verified_at' => now(),
                        '_lft'              => $lft,
                        '_rgt'              => $rgt,
                        'parent_id'         => $parentId,
                    ]
                );

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
            $email = $mapped['email']
                ?? $mapped['mail']
                ?? ($row['email'] ?? ($row['mail'] ?? ''));
            $name = $mapped['name']
                ?? $mapped['nom']
                ?? ($row['name'] ?? ($row['nom'] ?? ''));

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
     * À la fin de l'import old_DB :
     *  - on lit l'arbre du CSV depuis le cache
     *  - on mappe old_id -> User via l'email
     *  - on met à jour parent_id pour les utilisateurs importés
     *  - on appelle User::fixTree() (kalnoy/nestedset) pour recalculer _lft/_rgt
     *
     * Optionnel : si tu veux accrocher tout le sous-arbre sous un nœud existant,
     * tu peux passer son id via $state['attach_to'] dans le cache d'import.
     */
    private function attachImportedTreeAsBranch(string $id): void
    {
        $tree = Cache::get("import:$id:tree", []);

        if (empty($tree)) {
            return;
        }

        DB::transaction(function () use ($id, $tree) {
            // 1. récupérer tous les users importés via leurs emails
            $emails = array_column($tree, 'email');
            $emails = array_values(array_unique(array_filter($emails)));

            /** @var \Illuminate\Support\Collection|\App\Models\User[] $users */
            $users = User::whereIn('email', $emails)->get()->keyBy('email');

            // map old_id -> user_id
            $idMap = [];
            foreach ($tree as $oldId => $node) {
                $email = $node['email'] ?? null;
                if ($email && isset($users[$email])) {
                    $idMap[$oldId] = $users[$email]->id;
                }
            }

            // Optionnel : nœud parent "racine" sous lequel accrocher la nouvelle branche
            $state = Cache::get("import:$id", []);
            $attachParentId = $state['attach_to'] ?? null;

            // 2. mettre à jour parent_id pour tous les nœuds importés
            foreach ($tree as $oldId => $node) {
                $email = $node['email'] ?? null;
                if (!$email || !isset($users[$email])) {
                    continue;
                }

                /** @var \App\Models\User $user */
                $user = $users[$email];
                $parentOldId = $node['parent_old_id'] ?? null;

                if ($parentOldId && isset($idMap[$parentOldId])) {
                    // parent aussi importé
                    $user->parent_id = $idMap[$parentOldId];
                } else {
                    // racine dans le CSV
                    if ($attachParentId) {
                        // accrocher sous un nœud existant (branche unique sous attachParentId)
                        $user->parent_id = $attachParentId;
                    } else {
                        // sinon, nouveau root de l'arbre global
                        $user->parent_id = null;
                    }
                }

                $user->save();
            }

            // 3. recalculer tout l'arbre nested set en fonction des parent_id
            User::fixTree();
        });

        // On peut supprimer l'arbre du cache
        Cache::forget("import:$id:tree");
    }

    /**
     * Nettoyer les fichiers temporaires.
     */
    private function cleanupTempChunks(string $id): void
    {
        Storage::deleteDirectory('imports/tmp/' . $id);
    }
}
