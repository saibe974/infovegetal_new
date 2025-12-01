<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\DB;

class ImportProductCategories extends Command
{
    protected $signature = 'products:importCategories {--file= : Path to CSV file (relative to project root or absolute)} {--dry-run : Do not persist changes} {--batch=500 : Batch size for inserts}';

    protected $description = 'Import product categories from a CSV file into product_categories table (upsert by name)';

    public function handle()
    {
        $fileOpt = $this->option('file') ?? storage_path('imports/vegetal_fam.csv');
        $dryRun = $this->option('dry-run');
        $batchSize = (int) $this->option('batch');

        $fs = new Filesystem();

        if (! $fs->exists($fileOpt)) {
            $this->error("Fichier introuvable: {$fileOpt}");
            return 1;
        }

        $handle = fopen($fileOpt, 'r');
        if ($handle === false) {
            $this->error('Impossible d\'ouvrir le fichier CSV.');
            return 1;
        }

        // The categories CSV uses semicolon as delimiter: id;name
        $this->info('Lecture du CSV des categories (delim=;)');
        $rows = [];
        $rowCount = 0;
        $bar = null;

        // Attempt to read first line as header or as first row. We'll try to detect header.
        $firstLine = fgets($handle);
        if ($firstLine === false) {
            $this->error('Fichier CSV vide.');
            fclose($handle);
            return 1;
        }

        // Normalize line endings and split by semicolon
        $firstLine = trim($firstLine);
        $firstParts = str_getcsv($firstLine, ';');

        $hasHeader = false;
        if (is_array($firstParts) && count($firstParts) >= 2) {
            // if first column is 'id' or firstParts[1] === 'name', treat as header
            $h0 = strtolower(trim($firstParts[0]));
            $h1 = strtolower(trim($firstParts[1]));
            if ($h0 === 'id' || $h1 === 'name') {
                $hasHeader = true;
            }
        }

        if ($hasHeader) {
            // read remaining lines
        } else {
            // process the first line as data
            $data = $firstParts;
            if (count($data) < 2) {
                // skip if invalid
            } else {
                $row = ['id' => $data[0], 'name' => $data[1]];
                $rows[] = $this->mapRow($row);
                $rowCount++;
            }
        }

        while (($line = fgets($handle)) !== false) {
            if ($bar === null) {
                $bar = $this->output->createProgressBar();
                $bar->start();
            }

            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $parts = str_getcsv($line, ';');
            if (!is_array($parts) || count($parts) < 2) {
                // skip malformed
                $bar->advance();
                continue;
            }

            $row = ['id' => $parts[0], 'name' => $parts[1]];
            $rows[] = $this->mapRow($row);
            $rowCount++;
            $bar->advance();

            if (count($rows) >= $batchSize) {
                $this->persistBatch($rows, $dryRun);
                $rows = [];
            }
        }

        if ($bar) {
            $bar->finish();
            $this->line('');
        }

        if (count($rows) > 0) {
            $this->persistBatch($rows, $dryRun);
        }

        fclose($handle);

        $this->info('Import categories terminé.');
        return 0;
    }

    protected function mapRow(array $r): array
    {
        $id = $r['id'] ?? null;
        $id = is_numeric($id) ? (int)$id : null;
        
        $name = $r['name'] ?? null;
        $name = is_string($name) ? trim($name) : null;
        if ($name === '') $name = null;

        return [
            'id' => $id,
            'name' => $name,
        ];
    }

    protected function persistBatch(array $rows, bool $dryRun)
    {
        if ($dryRun) {
            $this->info("Dry-run: préparation d'un batch de " . count($rows) . " catégories");
            return;
        }

        $now = now();
        foreach ($rows as &$r) {
            $r['created_at'] = $now;
            $r['updated_at'] = $now;
        }

        // upsert by id (primary key)
        try {
            DB::table('category_products')->upsert($rows, ['id'], ['name', 'updated_at']);
            $this->info("Persisté batch de " . count($rows) . " catégories");
        } catch (\Throwable $e) {
            $this->error('Erreur lors de l\'import des catégories: ' . $e->getMessage());
        }
    }
}
