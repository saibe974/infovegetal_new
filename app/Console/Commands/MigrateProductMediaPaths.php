<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class MigrateProductMediaPaths extends Command
{
    protected $signature = 'media:migrate-product-paths
        {--dry-run : Simulate moves without writing files}
        {--product-id=* : Restrict migration to one or more product IDs}';

    protected $description = 'Move existing product media files to products/{category_products_id}/ path structure';

    public function handle(): int
    {
        $mediaModelClass = (string) config('media-library.media_model');
        if ($mediaModelClass === '' || !class_exists($mediaModelClass)) {
            $this->error('Media model class is not configured correctly.');
            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $productIds = array_values(array_unique(array_map('intval', (array) $this->option('product-id'))));
        $productIds = array_values(array_filter($productIds, static fn (int $id) => $id > 0));

        $query = $mediaModelClass::query()
            ->where('model_type', Product::class)
            ->where('collection_name', 'images')
            ->orderBy('id');

        if (!empty($productIds)) {
            $query->whereIn('model_id', $productIds);
        }

        $total = (clone $query)->count();
        if ($total === 0) {
            $this->info('No product media found to migrate.');
            return self::SUCCESS;
        }

        $this->info(sprintf('Scanning %d media item(s)%s...', $total, $dryRun ? ' [dry-run]' : ''));

        $movedOriginal = 0;
        $movedConversions = 0;
        $movedResponsive = 0;
        $alreadyMigrated = 0;
        $missingSource = 0;
        $errors = 0;

        $query->chunkById(100, function ($mediaItems) use (
            $dryRun,
            &$movedOriginal,
            &$movedConversions,
            &$movedResponsive,
            &$alreadyMigrated,
            &$missingSource,
            &$errors
        ) {
            foreach ($mediaItems as $media) {
                $disk = Storage::disk((string) $media->disk);

                $newOriginalPath = ltrim((string) $media->getPathRelativeToRoot(), '/');
                $oldBase = (string) $media->id;
                $oldOriginalPath = $oldBase . '/' . $media->file_name;

                if ($newOriginalPath === $oldOriginalPath || $disk->exists($newOriginalPath)) {
                    $alreadyMigrated++;
                } elseif ($disk->exists($oldOriginalPath)) {
                    if ($this->moveFile($disk, $oldOriginalPath, $newOriginalPath, $dryRun)) {
                        $movedOriginal++;
                    } else {
                        $errors++;
                        continue;
                    }
                } else {
                    $missingSource++;
                }

                $newDir = trim((string) dirname($newOriginalPath), '.\\/');
                $newConversionsDir = $newDir . '/conversions';
                $newResponsiveDir = $newDir . '/responsive-images';

                $oldConversionsDir = $oldBase . '/conversions';
                $oldResponsiveDir = $oldBase . '/responsive-images';

                if ($disk->exists($oldConversionsDir)) {
                    $movedConversions += $this->moveDirectoryFiles(
                        $disk,
                        $oldConversionsDir,
                        $newConversionsDir,
                        $dryRun
                    );
                }

                if ($disk->exists($oldResponsiveDir)) {
                    $movedResponsive += $this->moveDirectoryFiles(
                        $disk,
                        $oldResponsiveDir,
                        $newResponsiveDir,
                        $dryRun
                    );
                }
            }
        });

        $this->newLine();
        $this->line('Migration summary:');
        $this->line(' - Original files moved: ' . $movedOriginal);
        $this->line(' - Conversion files moved: ' . $movedConversions);
        $this->line(' - Responsive files moved: ' . $movedResponsive);
        $this->line(' - Already migrated: ' . $alreadyMigrated);
        $this->line(' - Missing source files: ' . $missingSource);
        $this->line(' - Errors: ' . $errors);

        if ($dryRun) {
            $this->warn('Dry-run completed. No file was moved.');
        }

        return $errors > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function moveFile($disk, string $from, string $to, bool $dryRun): bool
    {
        if ($dryRun) {
            $this->line(sprintf('[dry-run] move %s -> %s', $from, $to));
            return true;
        }

        if ($disk->exists($to)) {
            return true;
        }

        return (bool) $disk->move($from, $to);
    }

    private function moveDirectoryFiles($disk, string $fromDir, string $toDir, bool $dryRun): int
    {
        $moved = 0;
        $files = $disk->allFiles($fromDir);

        foreach ($files as $sourcePath) {
            $targetPath = rtrim($toDir, '/') . '/' . basename($sourcePath);

            if ($this->moveFile($disk, $sourcePath, $targetPath, $dryRun)) {
                $moved++;
            }
        }

        return $moved;
    }
}
