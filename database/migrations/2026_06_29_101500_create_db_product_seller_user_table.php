<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('db_product_seller_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('db_product_id')->constrained('db_products')->cascadeOnDelete();
            $table->foreignId('seller_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('billing_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('defaults')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['db_product_id', 'seller_user_id', 'billing_user_id'], 'db_product_seller_user_unique');
            $table->index(['db_product_id', 'seller_user_id']);
            $table->index(['seller_user_id', 'active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('db_product_seller_user');
    }
};
