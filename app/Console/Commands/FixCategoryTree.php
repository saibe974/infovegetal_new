<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\CategoryProducts;

class FixCategoryTree extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'categories:fix-tree';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Initialize nested set values for all categories';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Initializing category tree...');

        // Récupérer toutes les catégories sans valeurs nested set valides
        $categories = CategoryProducts::where('_lft', 0)
            ->where('_rgt', 0)
            ->whereNull('parent_id')
            ->get();

        $this->info("Found {$categories->count()} categories to initialize");

        foreach ($categories as $category) {
            $category->saveAsRoot();
            $this->info("✓ Initialized category: {$category->name} (ID: {$category->id})");
        }

        // Rebuild the entire tree to fix any inconsistencies
        CategoryProducts::fixTree();

        $this->info('✓ Category tree initialized successfully!');

        return Command::SUCCESS;
    }
}
