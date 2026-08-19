<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('users_options')->updateOrInsert(
            ['key' => 'users_meta.allowed_key', 'value' => 'pdf'],
            [
                'label' => 'Document PDF',
                'type' => 'meta_key',
                'sort_order' => 80,
                'active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        );

        DB::table('users_options')->updateOrInsert(
            ['key' => 'users_meta.input_kind', 'value' => 'pdf'],
            [
                'label' => 'file/pdf',
                'type' => 'pdf',
                'sort_order' => 80,
                'active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        );
    }

    public function down(): void
    {
        DB::table('users_options')
            ->where('value', 'pdf')
            ->whereIn('key', ['users_meta.allowed_key', 'users_meta.input_kind'])
            ->delete();
    }
};
