<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('db_product_user')) {
            Schema::create('db_product_user', function (Blueprint $table) {
                $table->id();
                $table->foreignId('db_product_id')->constrained('db_products')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->boolean('can_access')->default(false);
                $table->boolean('can_buy')->default(false);
                $table->boolean('can_invoice')->default(false);
                $table->boolean('can_sell')->default(false);
                $table->json('attributes')->nullable();
                $table->timestamps();

                $table->unique(['db_product_id', 'user_id']);
                $table->index(['user_id', 'can_access']);
                $table->index(['user_id', 'can_buy']);
                $table->index(['user_id', 'can_invoice']);
                $table->index(['user_id', 'can_sell']);
            });
        } else {
            Schema::table('db_product_user', function (Blueprint $table) {
                if (!Schema::hasColumn('db_product_user', 'can_access')) {
                    $table->boolean('can_access')->default(false)->after('user_id');
                }

                if (!Schema::hasColumn('db_product_user', 'can_buy')) {
                    $table->boolean('can_buy')->default(false)->after('can_access');
                }

                if (!Schema::hasColumn('db_product_user', 'can_invoice')) {
                    $table->boolean('can_invoice')->default(false)->after('can_buy');
                }

                if (!Schema::hasColumn('db_product_user', 'can_sell')) {
                    $table->boolean('can_sell')->default(false)->after('can_invoice');
                }

                if (!Schema::hasColumn('db_product_user', 'attributes')) {
                    $table->json('attributes')->nullable()->after('can_sell');
                }

                if (!Schema::hasColumn('db_product_user', 'created_at') && !Schema::hasColumn('db_product_user', 'updated_at')) {
                    $table->nullableTimestamps();
                }
            });

            try {
                Schema::table('db_product_user', function (Blueprint $table) {
                    $table->unique(['db_product_id', 'user_id']);
                });
            } catch (\Throwable $e) {
                // Unique key already exists.
            }

            try {
                Schema::table('db_product_user', function (Blueprint $table) {
                    $table->index(['user_id', 'can_access']);
                    $table->index(['user_id', 'can_buy']);
                    $table->index(['user_id', 'can_invoice']);
                    $table->index(['user_id', 'can_sell']);
                });
            } catch (\Throwable $e) {
                // Indexes may already exist.
            }
        }

        if (!Schema::hasTable('db_products_users')) {
            return;
        }

        $hasCanSell = Schema::hasColumn('db_products_users', 'can_sell');

        $rows = DB::table('db_products_users')->get([
            'db_product_id',
            'user_id',
            'attributes',
            ...( $hasCanSell ? ['can_sell'] : []),
            'created_at',
            'updated_at',
        ]);

        if ($rows->isEmpty()) {
            return;
        }

        $payload = $rows->map(function ($row) use ($hasCanSell) {
            $canSell = $hasCanSell ? (bool) ($row->can_sell ?? false) : true;

            return [
                'db_product_id' => (int) $row->db_product_id,
                'user_id' => (int) $row->user_id,
                'can_access' => true,
                'can_buy' => false,
                'can_invoice' => $canSell,
                'can_sell' => $canSell,
                'attributes' => $row->attributes,
                'created_at' => $row->created_at ?? now(),
                'updated_at' => $row->updated_at ?? now(),
            ];
        })->values()->all();

        DB::table('db_product_user')->upsert(
            $payload,
            ['db_product_id', 'user_id'],
            ['can_access', 'can_buy', 'can_invoice', 'can_sell', 'attributes', 'updated_at']
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Intentionally left non-destructive to protect migrated data.
    }
};
