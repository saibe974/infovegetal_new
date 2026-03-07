<?php

namespace Database\Seeders;

use App\Models\UserOption;
use Illuminate\Database\Seeder;

class UsersMetaKeysSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $items = [
            ['value' => 'custom', 'label' => 'Custom', 'sort_order' => 10],
            ['value' => 'mail', 'label' => 'Mail', 'sort_order' => 20],
            ['value' => 'logo', 'label' => 'Logo', 'sort_order' => 30],
            ['value' => 'tel', 'label' => 'Telephone', 'sort_order' => 40],
            ['value' => 'adress', 'label' => 'Adress', 'sort_order' => 50],
            ['value' => 'sales_conditions', 'label' => 'Conditions de vente', 'sort_order' => 60],
        ];

        foreach ($items as $item) {
            UserOption::updateOrCreate(
                [
                    'key' => 'users_meta.allowed_key',
                    'value' => $item['value'],
                ],
                [
                    'label' => $item['label'],
                    'type' => 'meta_key',
                    'sort_order' => $item['sort_order'],
                    'active' => true,
                ]
            );
        }
    }
}
