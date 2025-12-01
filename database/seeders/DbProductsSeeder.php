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
                'champs' => [],
                'categories' => [],
            ]
        );

        DbProducts::firstOrCreate(
            ['name' => 'Infovegetal_old'],
            [
                'description' => 'Anciennes bases Infovegetal',
                'champs' => [
                    'sku' => 'bc_ref',
                    'name' => 'latin',
                    'description' => 'rem',
                    'price' => 'prix',
                    'img_link' => 'img',
                    'category_products_id' => 'fam'
                ],
                'categories' => [],
                'traitement' => 'infovegetal_old',
            ]
        );


        DbProducts::firstOrCreate(
            ['name' => 'Eurofleurs'],
            [
                'description' => 'Bases Eurofleurs',
                'champs' => [
                    'sku' => 'ean',
                    'name' => 'article',
                    'description' => 'rem',
                    'price' => 'prix_plaque',
                    'img_link' => 'image',
                    'category_products_name' => 'groupe'
                ],
                'categories' => [],
                'traitement' => 'eurofleurs',
            ]
        );
    }
}
