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
        Schema::table('category_products', function (Blueprint $table) {
            $table->foreignId('tva_id')
                ->nullable()
                ->after('name')
                ->constrained('tva')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('category_products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tva_id');
        });
    }
};