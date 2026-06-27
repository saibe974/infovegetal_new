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
        Schema::create('db_product_billing_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('db_product_id')->constrained('db_products')->cascadeOnDelete();
            $table->foreignId('billing_user_id')->constrained('users')->cascadeOnDelete();
            $table->json('defaults')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['db_product_id', 'billing_user_id']);
            $table->index(['db_product_id', 'active']);
            $table->index(['billing_user_id', 'active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('db_product_billing_user');
    }
};
