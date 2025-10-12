<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Console\Commands\ImportProducts;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Register import command alias for convenience
Artisan::command('products:import {--file=} {--dry-run} {--batch=1000}', function () {
    $this->call(ImportProducts::class, [
        '--file' => $this->option('file') ?? null,
        '--dry-run' => $this->option('dry-run') ?? false,
        '--batch' => $this->option('batch') ?? 1000,
    ]);
})->describe('Import products from CSV (wrapper to ImportProducts command class)');
