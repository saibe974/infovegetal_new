<?php

namespace Database\Seeders;

use App\Models\DbProducts;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DbProductsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DbProducts::firstOrCreate(
            ['name' => 'Infovegetal'],
            [
                'description' => 'Description of Infovegetal',
                'defaults' => [
                    'barcode' => 'barcode',
                    'ref' => 'ref',
                    'name' => 'name',
                ],
                'mergins' => [],
            ]
        );

        DbProducts::firstOrCreate(
            ['name' => 'Infovegetal_old'],
            [
                'description' => 'Ancienne bases Infovegetal',
                'defaults' => [
                    'barcode' => 'barcode',
                    'ref' => 'ref',
                    'name' => 'name',
                ],
                'mergins' => [],
            ]
        );
    }
}
