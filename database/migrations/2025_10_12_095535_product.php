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
        Schema::create('products', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('sku')->unique();     // code article interne
            $t->string('name');
            $t->text('description')->nullable();
            $t->string('img_link')->nullable();
            // $t->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            // $t->foreignId('producer_id')->nullable()->constrained()->nullOnDelete();
            // $t->string('unit')->default('piece'); // piece, colis, palette...
            $t->decimal('price', 12, 2)->default(0);
            // $t->foreignId('tax_id')->nullable()->constrained('taxes')->nullOnDelete();
            $t->boolean('active')->default(true);
            $t->json('attributes')->nullable(); // couleur, calibre, etc.
            $t->timestamps();
            $t->softDeletes();
            // $t->index(['name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
