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
                'description' => 'Bases Infovegetal',
                'defaults' => [],
                'mergins' => [],
            ]
        );

        DbProducts::firstOrCreate(
            ['name' => 'Infovegetal_old'],
            [
                'description' => 'Anciennes bases Infovegetal',
                'defaults' => [
                    'sku' => 'bc_ref',
                    'name' => 'latin',
                    'description' => 'rem',
                    'price' => 'prix',
                    'img_link' => 'img',
                    'product_category_id' => 'fam'
                ],
                'mergins' => [],
            ]
        );
    }
}
