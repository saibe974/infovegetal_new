<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', function (Blueprint $table): void {
            $table->json('discounts')->nullable()->after('transport_selection');
        });

        Schema::table('order_headers', function (Blueprint $table): void {
            $table->decimal('discount_total_ht', 14, 2)->default(0)->after('shipping_total_ht');
        });
    }

    public function down(): void
    {
        Schema::table('order_headers', function (Blueprint $table): void {
            $table->dropColumn('discount_total_ht');
        });

        Schema::table('carts', function (Blueprint $table): void {
            $table->dropColumn('discounts');
        });
    }
};
