<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class ImportProducts extends Command
{
    protected $signature = 'products:import {--file= : Path to CSV file (relative to project root or absolute)} {--dry-run : Do not persist changes} {--batch=1000 : Batch size for inserts} {--create-categories : Create missing product categories when referenced by name}';

    protected $description = 'Import products from a CSV file into products table (upsert by sku)';

    // map name(lower) => id
    protected $categoryMap = [];

    // create categories when name not found
    protected $createMissingCategories = false;

    // statistics for reporting
    protected $stats = [
        'total' => 0,
        'resolved' => 0,
        'created' => 0,
        'unresolved' => 0,
    ];

    public function handle()
    {
        $fileOpt = $this->option('file') ?? storage_path('imports/vegetal_produits_50K.csv');
        $dryRun = $this->option('dry-run');
        $batchSize = (int) $this->option('batch');
        $this->createMissingCategories = (bool) $this->option('create-categories');

        $fs = new Filesystem();

        if (! $fs->exists($fileOpt)) {
            $this->error("Fichier introuvable: {$fileOpt}");
            return 1;
        }

        // Native CSV reader (no external dependency required)
        $handle = fopen($fileOpt, 'r');
        if ($handle === false) {
            $this->error('Impossible d\'ouvrir le fichier CSV.');
            return 1;
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            $this->error('Fichier CSV vide ou entête introuvable.');
            fclose($handle);
            return 1;
        }

        // load categories map (normalized name => id) to resolve category names quickly
        $this->categoryMap = [];
        try {
            $cats = DB::table('product_categories')->select('id', 'name')->get();
            foreach ($cats as $c) {
                $key = $this->normalizeKey($c->name);
                if ($key !== '') $this->categoryMap[$key] = $c->id;
            }
        } catch (\Throwable $e) {
            // if table missing or other DB issue, continue but leave map empty
            $this->warn('Impossible de charger les product_categories: ' . $e->getMessage());
        }

        $this->info('Lecture du CSV (native)');
        $rows = [];
        $rowCount = 0;
        $bar = null;

        while (($data = fgetcsv($handle)) !== false) {
            if ($bar === null) {
                $bar = $this->output->createProgressBar();
                $bar->start();
            }

            // Normalize header/data length: pad or truncate so array_combine won't fail
            // Trim header values once for robustness
            $header = array_map(fn($h) => is_string($h) ? trim($h) : $h, $header);

            if (count($data) !== count($header)) {
                if (count($data) < count($header)) {
                    // pad missing values with null
                    $data = array_pad($data, count($header), null);
                } else {
                    // truncate extra columns to match header
                    $data = array_slice($data, 0, count($header));
                }
            }

            $row = array_combine($header, $data);
            $rows[] = $this->mapRow($row);
            $rowCount++;
            $this->stats['total']++;
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
        $this->info('Import terminé.');
        $this->info(sprintf("Total lignes traitées: %d — résolus: %d — créés: %d — non résolus: %d", $this->stats['total'], $this->stats['resolved'], $this->stats['created'], $this->stats['unresolved']));
        return 0;
    }

    protected function mapRow(array $r): array
    {
        // CSV headers: id,sku,name,img_link,description,price,active
        // DB columns (products): sku, name, description, img_link, price, active, attributes
        $sku = trim($r['sku'] ?? '');
        $name = trim($r['name'] ?? '');
        $description = trim($r['description'] ?? '');
        $img = $r['img_link'] ?? null;
        if ($img === 'NULL') $img = null;

        $price = $r['price'] ?? 0;
        // price in CSV may use dot as decimal separator
        $price = is_numeric($price) ? number_format((float)$price, 2, '.', '') : 0;

        $active = $r['active'] ?? 1;
        $active = in_array((string)$active, ['1','true','yes'], true) ? 1 : 0;

        // Keep original CSV id as external_id attribute
        $attributes = [];
        if (!empty($r['id'])) $attributes['external_id'] = (string)$r['id'];

        // Resolve product_category_id from several possible CSV fields
        /*
        $product_category_id = null;
        if (!empty($r['product_category_id'])) {
            $product_category_id = is_numeric($r['product_category_id']) ? (int)$r['product_category_id'] : null;
            if ($product_category_id) $this->stats['resolved']++;
        } else {
            // try category name fields
            $possible = ['category', 'product_category', 'product_category_name'];
            $foundName = null;
            foreach ($possible as $k) {
                if (!empty($r[$k])) {
                    $foundName = trim($r[$k]);
                    break;
                }
            }

            if ($foundName) {
                $key = $this->normalizeKey($foundName);
                if ($key !== '' && isset($this->categoryMap[$key])) {
                    $product_category_id = $this->categoryMap[$key];
                    $this->stats['resolved']++;
                } else {
                    // create category on demand if option enabled
                    if ($this->createMissingCategories) {
                        try {
                            $now = now();
                            $id = DB::table('product_categories')->insertGetId([
                                'name' => $foundName,
                                'created_at' => $now,
                                'updated_at' => $now,
                            ]);
                            $this->categoryMap[$key] = $id;
                            $product_category_id = $id;
                            $this->stats['created']++;
                        } catch (\Throwable $e) {
                            // ignore creation error and leave null
                            $this->warn('Impossible de créer la catégorie "' . $foundName . '": ' . $e->getMessage());
                            $this->stats['unresolved']++;
                        }
                    } else {
                        $this->stats['unresolved']++;
                    }
                }
            } else {
                $this->stats['unresolved']++;
            }
        }
        */

        $product_category_id = $r['product_category_id'] ?? null;
        
        return [
            'sku' => $sku,
            'name' => $name,
            'description' => $description ?: null,
            'img_link' => $img,
            'price' => $price,
            'active' => $active,
            'product_category_id' => $product_category_id,
            'attributes' => json_encode($attributes),
        ];
    }

    protected function normalizeKey(?string $s): string
    {
        if ($s === null) return '';
        // Lowercase
        $key = mb_strtolower($s);
        // Remove accents
        $key = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $key) ?: $key;
        // Replace non alnum by space
        $key = preg_replace('/[^a-z0-9]+/', ' ', $key);
        // Collapse spaces
        $key = preg_replace('/\s+/', ' ', $key);
        return trim($key);
    }

    protected function persistBatch(array $rows, bool $dryRun)
    {
        if ($dryRun) {
            $this->info("Dry-run: préparation d'un batch de " . count($rows) . " enregistrements");
            return;
        }

        // upsert by sku
        $now = now();
        foreach ($rows as &$r) {
            $r['created_at'] = $now;
            $r['updated_at'] = $now;
        }

        $skus = array_column($rows, 'sku');

        // Use DB upsert
        try {
            DB::table('products')->upsert($rows, ['sku'], ['name','description','img_link','price','active','attributes','product_category_id','updated_at']);
            $this->info("Persisté batch de " . count($rows));
        } catch (\Throwable $e) {
            $this->error('Erreur lors de l import: ' . $e->getMessage());
        }
    }
}
