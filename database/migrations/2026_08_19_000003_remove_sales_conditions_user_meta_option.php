<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users_options')
            ->where('key', 'users_meta.allowed_key')
            ->where('value', 'sales_conditions')
            ->delete();
    }

    public function down(): void
    {
        $now = now();

        DB::table('users_options')->updateOrInsert(
            ['key' => 'users_meta.allowed_key', 'value' => 'sales_conditions'],
            [
                'label' => 'Conditions de vente',
                'type' => 'meta_key',
                'sort_order' => 70,
                'active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        );
    }
};
