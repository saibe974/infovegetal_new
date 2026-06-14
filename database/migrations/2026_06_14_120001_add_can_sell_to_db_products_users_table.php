<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('db_products_users', function (Blueprint $table) {
            $table->boolean('can_sell')->default(true)->after('attributes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('db_products_users', function (Blueprint $table) {
            $table->dropColumn('can_sell');
        });
    }
};
