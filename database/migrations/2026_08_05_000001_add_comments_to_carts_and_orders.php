<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->text('comment')->nullable()->after('discounts');
        });
        Schema::table('cart_product', function (Blueprint $table) {
            $table->text('comment')->nullable()->after('quantity');
        });
        Schema::table('order_headers', function (Blueprint $table) {
            $table->text('comment')->nullable()->after('status');
        });
        Schema::table('order_lines', function (Blueprint $table) {
            $table->text('comment')->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('order_lines', fn (Blueprint $table) => $table->dropColumn('comment'));
        Schema::table('order_headers', fn (Blueprint $table) => $table->dropColumn('comment'));
        Schema::table('cart_product', fn (Blueprint $table) => $table->dropColumn('comment'));
        Schema::table('carts', fn (Blueprint $table) => $table->dropColumn('comment'));
    }
};
