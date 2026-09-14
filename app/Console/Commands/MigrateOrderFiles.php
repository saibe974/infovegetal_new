<?php

namespace App\Console\Commands;

use App\Models\Cart;
use App\Models\File;
use App\Models\User;
use App\Services\OrderDocumentService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class MigrateOrderFiles extends Command
{
    protected $signature = 'orders:migrate-files {--apply : Copier les fichiers identifiés et mettre à jour les références} {--retire-public : Retirer les sources publiques vérifiées et mettre les sources ambiguës en quarantaine privée}';

    protected $description = 'Inventorier et migrer les anciens fichiers de commandes vers les espaces privés';

    public function handle(OrderDocumentService $documents): int
    {
        if ($this->option('retire-public') && ! $this->option('apply')) {
            $this->error('--retire-public nécessite --apply.');

            return self::FAILURE;
        }
        $sources = [];
        foreach (['public', 'local'] as $disk) {
            foreach (Storage::disk($disk)->allFiles('commandes') as $path) {
                $sources[$disk.':'.$path] = ['disk' => $disk, 'path' => $path, 'media_ids' => []];
            }
        }
        Media::query()->where('collection_name', 'user_meta_files')->each(function (Media $media) use (&$sources) {
            if ($media->getCustomProperty('source') !== 'cart-tcpdf' || ! ($media->model instanceof User)) {
                return;
            }
            $path = $media->getPathRelativeToRoot();
            $key = $media->disk.':'.$path;
            $sources[$key] ??= ['disk' => $media->disk, 'path' => $path, 'media_ids' => [], 'owner_id' => $media->model_id];
            $sources[$key]['media_ids'][] = $media->id;
        });
        $unresolved = 0;
        foreach ($sources as $source) {
            $disk = $source['disk'];
            $path = $source['path'];
            $records = File::query()->where('file_path', $path)->whereNull('document_key')->get();
            $ownerIds = $records->pluck('user_id')->unique()->values()->all();
            $isPdf = strtolower(pathinfo($path, PATHINFO_EXTENSION)) === 'pdf';
            $cartId = null;
            $expectedClientId = null;
            if (preg_match('~^commandes/(\d+)/(\d+)(?:[_-]|\.pdf$)~', $path, $matches)) {
                $ownerIds[] = (int) $matches[1];
                $cartId = (int) $matches[2];
                $expectedClientId = (int) $matches[1];
            } elseif (preg_match('~^commandes/facturants/(\d+)/client-(\d+)/order_(\d+)_~', $path, $matches)) {
                $ownerIds[] = (int) $matches[1];
                $cartId = (int) $matches[3];
                $expectedClientId = (int) $matches[2];
            } elseif (! empty($source['owner_id']) && preg_match('/^(\d+)[_-]/', basename($path), $matches)) {
                $ownerIds[] = (int) $source['owner_id'];
                $cartId = (int) $matches[1];
            }
            $cart = $cartId ? Cart::with('orderHeaders.lines')->find($cartId) : null;
            $ownerIds = array_values(array_unique(array_map('intval', $ownerIds)));
            // A PDF is safe to attribute from its client folder only when the order agrees.
            if (! $cart || ! $ownerIds || ($expectedClientId !== null && $expectedClientId !== (int) $cart->user_id)
                || ($isPdf && $ownerIds !== [(int) $cart->user_id])
                || User::whereIn('id', $ownerIds)->count() !== count($ownerIds)
                || ! Storage::disk($disk)->exists($path)) {
                $this->warn($this->option('retire-public') && $disk === 'public'
                    ? 'À examiner, mise en quarantaine privée : '.$disk.':'.$path
                    : 'À examiner (aucune modification) : '.$disk.':'.$path);
                $unresolved++;
                if ($disk === 'public' && $this->option('retire-public')) {
                    $this->quarantine($source);
                }

                continue;
            }
            if ($isPdf) {
                $snapshot = $cart->orderHeaders->first();
                $dbIds = $snapshot?->lines->pluck('db_product_id')->filter()->unique();
                if ($snapshot && $dbIds->count() === 1 && (int) $snapshot->db_product_id === (int) $dbIds->first()) {
                    $ownerIds = array_values(array_unique(array_filter(array_merge($ownerIds, [
                        $snapshot->billing_user_id, $snapshot->seller_user_id,
                    ]))));
                    $ownerIds = User::whereIn('id', $ownerIds)->pluck('id')->all();
                } else {
                    $this->warn('PDF conservé pour le client uniquement : les destinataires historiques par base ne sont pas établis.');
                }
            }
            $this->line(($this->option('apply') ? 'Migration' : 'Simulation').' : '.$disk.':'.$path.' -> utilisateurs '.implode(', ', $ownerIds));
            if (! $this->option('apply')) {
                continue;
            }
            $contents = Storage::disk($disk)->get($path);
            $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $mime = match ($extension) {
                'pdf' => 'application/pdf', 'csv' => 'text/csv', 'tsv' => 'text/tab-separated-values',
                'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                default => null,
            };
            if (! $mime) {
                $this->warn('Format non pris en charge : '.$path);
                $unresolved++;
                if ($disk === 'public' && $this->option('retire-public')) {
                    $this->quarantine($source);
                }

                continue;
            }
            foreach ($ownerIds as $ownerId) {
                // Retain historical versions without replacing an already regenerated document.
                $copy = $documents->store($cart, $ownerId, 'legacy-'.hash('sha256', $disk.':'.$path),
                    $records->first()?->file_name ?? basename($path), $contents, $mime);
                if (hash('sha256', Storage::disk($copy['disk'])->get($copy['relative_path'])) !== hash('sha256', $contents)) {
                    throw new \RuntimeException('Vérification de copie échouée : '.$path);
                }
                $this->record($source, $copy, hash('sha256', $contents));
            }
            // Removing a Media model would recursively delete the shared user-meta directory.
            // Retire only the verified source file and its exact metadata rows.
            if ($disk !== 'public' || $this->option('retire-public')) {
                if (! Storage::disk($disk)->delete($path)) {
                    throw new \RuntimeException('Impossible de retirer la source : '.$path);
                }
                DB::table('media')->whereIn('id', $source['media_ids'])->delete();
                File::query()->whereIn('id', $records->pluck('id'))->delete();
            }
        }
        $this->info(count($sources).' source(s), '.$unresolved.' à examiner.');
        if (! $this->option('apply')) {
            $this->info('Aucun fichier modifié. Utiliser --apply puis --retire-public pour retirer les sources publiques vérifiées.');
        }

        return $unresolved ? self::FAILURE : self::SUCCESS;
    }

    private function quarantine(array $source): void
    {
        if (! Storage::disk('public')->exists($source['path'])) {
            return;
        }
        $contents = Storage::disk('public')->get($source['path']);
        $hash = hash('sha256', $contents);
        $target = 'order-file-migration/quarantine/'.hash('sha256', $source['path']).'/'.$hash;
        if (! Storage::disk('local')->put($target, $contents)
            || hash('sha256', Storage::disk('local')->get($target)) !== $hash) {
            throw new \RuntimeException('Impossible de vérifier la quarantaine : '.$source['path']);
        }
        $this->record($source, ['relative_path' => $target, 'status' => 'quarantine'], $hash);
        if (! Storage::disk('public')->delete($source['path'])) {
            throw new \RuntimeException('Impossible de retirer la source publique : '.$source['path']);
        }
        $this->warn('Source mise en quarantaine privée, sans attribution : '.$target);
    }

    private function record(array $source, array $copy, string $hash): void
    {
        $report = 'order-file-migration/records/'.hash('sha256', $source['disk'].':'.$source['path']).'/'.($copy['owner_user_id'] ?? 'quarantine').'.json';
        if (! Storage::disk('local')->put($report, json_encode([
            'source' => $source, 'destination' => $copy, 'sha256' => $hash, 'migrated_at' => now()->toIso8601String(),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR))) {
            throw new \RuntimeException('Impossible de sauvegarder le journal de migration.');
        }
    }
}
