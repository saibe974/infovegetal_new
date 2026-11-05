<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PrivatizeFiles extends Command
{
    protected $signature = 'security:privatize-files {--apply} {--rollback} {--run=local-security : Identifiant du journal privé}';

    protected $description = 'Copier, vérifier et retirer les documents/imports publics sans modifier les médias publics';

    public function handle(): int
    {
        if ($this->option('apply') && ! app()->environment(['local', 'testing'])) {
            $this->error('Cette reprise est limitée aux environnements local et testing.');

            return self::FAILURE;
        }
        $run = $this->option('run');
        if (! preg_match('/\A[a-zA-Z0-9_-]{1,80}\z/', $run) || ($this->option('rollback') && ! $this->option('apply'))) {
            $this->error('Identifiant invalide ou --rollback sans --apply.');

            return self::FAILURE;
        }

        return Cache::lock('security:privatize-files', 3600)->block(5, fn () => $this->executeRun($run));
    }

    private function executeRun(string $run): int
    {
        $public = Storage::disk('public');
        $private = Storage::disk('local');
        $journal = 'security-migration/'.$run.'.json';
        $items = $private->exists($journal) ? json_decode($private->get($journal), true, flags: JSON_THROW_ON_ERROR) : null;
        if ($items === null && $this->option('rollback')) {
            $this->error('Journal introuvable.');

            return self::FAILURE;
        }
        if ($items === null) {
            $paths = array_filter($public->allFiles(), fn ($p) => preg_match('~\A(?:commandes/|imports/|user-meta/[0-9]+/commandes/)~', $p));
            $media = DB::table('media')->where('disk', 'public')->where('collection_name', 'user_meta_files')->get();
            foreach ($media as $row) {
                $properties = json_decode($row->custom_properties, true);
                if (($properties['source'] ?? null) === 'cart-tcpdf') {
                    $model = \Spatie\MediaLibrary\MediaCollections\Models\Media::find($row->id);
                    $paths[] = $model->getPathRelativeToRoot();
                }
            }
            $items = [];
            foreach (array_unique($paths) as $path) {
                if (str_contains($path, '..') || str_contains($path, '\\') || str_starts_with($path, '/')) {
                    throw new \RuntimeException('Chemin non sûr dans l’inventaire.');
                }
                $files = DB::table('files')->where('disk', 'public')->where('file_path', $path)->pluck('id')->all();
                $mediaIds = $media->filter(function ($row) use ($path) {
                    return (json_decode($row->custom_properties, true)['source'] ?? null) === 'cart-tcpdf'
                        && \Spatie\MediaLibrary\MediaCollections\Models\Media::find($row->id)->getPathRelativeToRoot() === $path;
                })->pluck('id')->all();
                $items[] = ['path' => $path, 'sha256' => $this->hash($public, $path), 'files' => $files, 'media' => $mediaIds];
            }
        }
        $this->info(count($items).' fichier(s) inventorié(s). Aucun nom ni contenu affiché.');
        if (! $this->option('apply')) {
            return self::SUCCESS;
        }
        if (! $private->exists($journal)) {
            abort_unless($private->put($journal, json_encode($items, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT)), 500);
        }
        foreach ($items as $item) {
            $rollback = (bool) $this->option('rollback');
            $source = $rollback ? $private : $public;
            $target = $rollback ? $public : $private;
            $path = $item['path'];
            if ($source->exists($path)) {
                if (! hash_equals($item['sha256'], $this->hash($source, $path))) {
                    throw new \RuntimeException('Source modifiée : reprise interrompue sans suppression.');
                }
                if ($target->exists($path) && ! hash_equals($item['sha256'], $this->hash($target, $path))) {
                    throw new \RuntimeException('Destination différente : aucun écrasement.');
                }
                if (! $target->exists($path)) {
                    $stream = $source->readStream($path);
                    try {
                        abort_unless($target->put($path, $stream), 500);
                    } finally {
                        fclose($stream);
                    }
                }
            }
            if (! $target->exists($path) || ! hash_equals($item['sha256'], $this->hash($target, $path))) {
                throw new \RuntimeException('Copie absente ou empreinte invalide.');
            }
            DB::transaction(function () use ($item, $rollback, $path) {
                $from = $rollback ? 'local' : 'public';
                $to = $rollback ? 'public' : 'local';
                // References changed since the inventory must be reviewed rather than overwritten.
                $rows = DB::table('files')->whereIn('id', $item['files'])->lockForUpdate()->get();
                foreach ($rows as $row) {
                    if ($row->file_path !== $path || ! in_array($row->disk, [$from, $to], true)) {
                        throw new \RuntimeException('Référence modifiée depuis l’inventaire.');
                    }
                }
                DB::table('files')->whereIn('id', $item['files'])->update(['disk' => $to]);
                foreach (DB::table('media')->whereIn('id', $item['media'])->lockForUpdate()->get() as $row) {
                    $model = \Spatie\MediaLibrary\MediaCollections\Models\Media::find($row->id);
                    if (! in_array($row->disk, [$from, $to], true) || $model->getPathRelativeToRoot() !== $path) {
                        throw new \RuntimeException('Référence média modifiée depuis l’inventaire.');
                    }
                }
                DB::table('media')->whereIn('id', $item['media'])->where('disk', $from)->update(['disk' => $to]);
            });
            foreach ($item['files'] as $id) {
                $state = Cache::get('import:'.$id);
                if (is_array($state) && ($state['path'] ?? null) === $path) {
                    $state['disk'] = $rollback ? 'public' : 'local';
                    Cache::put('import:'.$id, $state, now()->addHour());
                }
            }
            if (! $rollback && $public->exists($path)) {
                if (! hash_equals($item['sha256'], $this->hash($public, $path))) {
                    throw new \RuntimeException('Source modifiée pendant la copie : suppression refusée.');
                }
                abort_unless($public->delete($path), 500);
            }
            // Rollback retains the verified private copy and Apache still denies its public URL.
        }
        $this->info($this->option('rollback') ? 'Retour arrière vérifié. Copie privée et protections HTTP conservées.' : 'Copies et références vérifiées ; sources publiques retirées.');

        return self::SUCCESS;
    }

    private function hash($disk, string $path): string
    {
        $stream = $disk->readStream($path);
        if (! is_resource($stream)) {
            throw new \RuntimeException('Source inaccessible ; aucune suppression autorisée.');
        }
        try {
            $context = hash_init('sha256');
            hash_update_stream($context, $stream);

            return hash_final($context);
        } finally {
            fclose($stream);
        }
    }
}
