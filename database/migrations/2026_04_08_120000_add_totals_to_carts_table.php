<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->decimal('items_total', 10, 2)->default(0)->after('user_id');
            $table->decimal('shipping_total', 10, 2)->default(0)->after('items_total');
        });
    }

    public function down(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->dropColumn(['items_total', 'shipping_total']);
        });
    }
};
