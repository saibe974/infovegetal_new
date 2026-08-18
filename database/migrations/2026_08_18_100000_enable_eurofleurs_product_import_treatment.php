<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('db_products')
            ->whereRaw('LOWER(name) = ?', ['eurofleurs'])
            ->whereNull('traitement')
            ->update(['traitement' => 'eurofleurs']);
    }

    public function down(): void
    {
        // Data repair: keep the treatment enabled on rollback because rows that
        // already had this value cannot be distinguished from repaired rows.
    }
};
