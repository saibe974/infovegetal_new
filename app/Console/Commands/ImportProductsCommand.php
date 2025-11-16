<?php

namespace App\Console\Commands;

use App\Http\Controllers\ProductController;
use Illuminate\Console\Command;

class ImportProductsCommand extends Command
{
    protected $signature = 'products:import-process {id} {fullPath} {relativePath}';
    protected $description = 'Process CSV import in background';

    public function handle()
    {
        $id = $this->argument('id');
        $fullPath = $this->argument('fullPath');
        $relativePath = $this->argument('relativePath');

        $controller = new ProductController();
        $controller->processImport($id, $fullPath, $relativePath);

        return 0;
    }
}
