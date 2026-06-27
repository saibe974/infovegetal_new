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
        Schema::create('client_sales_conditions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('db_product_id')->constrained('db_products')->cascadeOnDelete();
            $table->foreignId('billing_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('seller_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('conditions_override')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['client_user_id', 'db_product_id', 'billing_user_id', 'seller_user_id'], 'client_sales_conditions_unique');
            $table->index(['client_user_id', 'active']);
            $table->index(['db_product_id', 'active']);
            $table->index(['billing_user_id', 'active']);
            $table->index(['seller_user_id', 'active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('client_sales_conditions');
    }
};
