<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('db_product_seller_user', function (Blueprint $table) {
            if (Schema::hasColumn('db_product_seller_user', 'defaults') && !Schema::hasColumn('db_product_seller_user', 'seller_defaults')) {
                $table->renameColumn('defaults', 'seller_defaults');
            }
        });

        Schema::table('db_product_seller_user', function (Blueprint $table) {
            if (!Schema::hasColumn('db_product_seller_user', 'conditions')) {
                $table->json('conditions')->nullable()->after('seller_user_id');
            }

            if (!Schema::hasColumn('db_product_seller_user', 'use_billing_profile')) {
                $table->boolean('use_billing_profile')->default(true)->after('conditions');
            }

            if (!Schema::hasColumn('db_product_seller_user', 'billing_profile_id')) {
                $table->string('billing_profile_id')->nullable()->after('use_billing_profile');
            }

            if (!Schema::hasColumn('db_product_seller_user', 'seller_defaults')) {
                $table->json('seller_defaults')->nullable()->after('billing_profile_id');
            }

            if (!Schema::hasColumn('db_product_seller_user', 'can_manage')) {
                $table->boolean('can_manage')->default(false)->after('seller_defaults');
            }
        });
    }

    public function down(): void
    {
        Schema::table('db_product_seller_user', function (Blueprint $table) {
            if (Schema::hasColumn('db_product_seller_user', 'can_manage')) {
                $table->dropColumn('can_manage');
            }
            if (Schema::hasColumn('db_product_seller_user', 'seller_defaults')) {
                $table->dropColumn('seller_defaults');
            }
            if (Schema::hasColumn('db_product_seller_user', 'billing_profile_id')) {
                $table->dropColumn('billing_profile_id');
            }
            if (Schema::hasColumn('db_product_seller_user', 'use_billing_profile')) {
                $table->dropColumn('use_billing_profile');
            }
            if (Schema::hasColumn('db_product_seller_user', 'conditions')) {
                $table->dropColumn('conditions');
            }
        });

        Schema::table('db_product_seller_user', function (Blueprint $table) {
            if (!Schema::hasColumn('db_product_seller_user', 'defaults') && Schema::hasColumn('db_product_seller_user', 'seller_defaults')) {
                $table->renameColumn('seller_defaults', 'defaults');
            }
        });
    }
};
