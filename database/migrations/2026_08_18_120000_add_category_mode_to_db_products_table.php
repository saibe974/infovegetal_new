<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('db_products', function (Blueprint $table) {
            $table->string('category_mode', 16)->default('column')->after('categories');
            $table->string('category_block_prefix')->nullable()->after('category_mode');
            $table->unsignedSmallInteger('category_block_column')->nullable()->after('category_block_prefix');
        });

        DB::table('db_products')
            ->where(function ($query) {
                $query->where('traitement', 'ddk')->orWhereRaw('LOWER(name) = ?', ['ddk']);
            })
            ->update([
                'category_mode' => 'block',
                'category_block_prefix' => "Famille d'articles:",
                'category_block_column' => null,
            ]);
    }

    public function down(): void
    {
        Schema::table('db_products', function (Blueprint $table) {
            $table->dropColumn(['category_mode', 'category_block_prefix', 'category_block_column']);
        });
    }
};
