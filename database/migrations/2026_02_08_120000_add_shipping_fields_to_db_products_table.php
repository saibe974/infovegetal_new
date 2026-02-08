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
        Schema::table('db_products', function (Blueprint $table) {
            $table->string('country', 2)->nullable()->comment('Country code');
            $table->string('mod_liv')->nullable()->comment('Delivery mode');
            $table->unsignedInteger('mini')->nullable()->comment('Minimum rolls');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('db_products', function (Blueprint $table) {
            $table->dropColumn(['country', 'mod_liv', 'mini']);
        });
    }
};
