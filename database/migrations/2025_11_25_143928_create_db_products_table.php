<?php

use App\Models\DbProducts;
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
        Schema::create('db_products', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('description')->nullable();
            $table->json('champs')->nullable();
            $table->json('categories')->nullable();
            $table->timestamps();
        });

         Schema::table('products', function (Blueprint $table) {
            $table->foreignIdFor(DbProducts::class)->nullable()->constrained()->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('db_products');
        
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeignIdFor(DbProducts::class);
        });
    }
};
