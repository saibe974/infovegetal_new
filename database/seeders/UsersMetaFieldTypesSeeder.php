<?php

namespace Database\Seeders;

use App\Models\UserOption;
use Illuminate\Database\Seeder;

class UsersMetaFieldTypesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $kinds = [
            ['value' => 'custom', 'label' => 'input', 'type' => 'string', 'sort_order' => 10],
            ['value' => 'mail', 'label' => 'mail', 'type' => 'email', 'sort_order' => 20],
            ['value' => 'logo', 'label' => 'file/image', 'type' => 'image', 'sort_order' => 30],
            ['value' => 'phone', 'label' => 'phone', 'type' => 'phone', 'sort_order' => 40],
            ['value' => 'mobile', 'label' => 'mobile', 'type' => 'phone', 'sort_order' => 50],
            ['value' => 'adress', 'label' => 'json', 'type' => 'address', 'sort_order' => 60],
            ['value' => 'sales_conditions', 'label' => 'textarea', 'type' => 'text', 'sort_order' => 70],
        ];

        foreach ($kinds as $item) {
            UserOption::updateOrCreate(
                [
                    'key' => 'users_meta.input_kind',
                    'value' => $item['value'],
                ],
                [
                    'label' => $item['label'],
                    'type' => $item['type'],
                    'sort_order' => $item['sort_order'],
                    'active' => true,
                ]
            );
        }

        UserOption::updateOrCreate(
            [
                'key' => 'users_meta.input_fields',
                'value' => 'adress',
            ],
            [
                'label' => 'number,road,zip,town',
                'type' => 'json_fields',
                'sort_order' => 60,
                'active' => true,
            ]
        );
    }
}
