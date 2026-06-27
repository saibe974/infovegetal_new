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
        if (!Schema::hasTable('db_product_user')) {
            return;
        }

        Schema::table('db_product_user', function (Blueprint $table) {
            if (!Schema::hasColumn('db_product_user', 'can_manage')) {
                $table->boolean('can_manage')->default(false)->after('can_sell');
            }
        });

        try {
            Schema::table('db_product_user', function (Blueprint $table) {
                $table->index(['user_id', 'can_manage']);
            });
        } catch (\Throwable $e) {
            // Index may already exist.
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('db_product_user')) {
            return;
        }

        try {
            Schema::table('db_product_user', function (Blueprint $table) {
                $table->dropIndex(['user_id', 'can_manage']);
            });
        } catch (\Throwable $e) {
            // Ignore when index does not exist.
        }

        Schema::table('db_product_user', function (Blueprint $table) {
            if (Schema::hasColumn('db_product_user', 'can_manage')) {
                $table->dropColumn('can_manage');
            }
        });
    }
};
