<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_headers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cart_id')->nullable()->constrained('carts')->nullOnDelete();
            $table->foreignId('client_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('billing_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('seller_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('db_product_id')->nullable()->constrained('db_products')->nullOnDelete();
            $table->string('order_number', 40)->unique();
            $table->timestamp('order_date')->index();
            $table->string('status', 30)->default('completed')->index();
            $table->char('currency', 3)->default('EUR');
            $table->decimal('items_total_ht', 14, 2)->default(0);
            $table->decimal('shipping_total_ht', 14, 2)->default(0);
            $table->decimal('total_ht', 14, 2)->default(0);
            $table->decimal('total_tva', 14, 2)->default(0);
            $table->decimal('total_ttc', 14, 2)->default(0);
            $table->json('conditions_snapshot')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['client_user_id', 'order_date']);
            $table->index(['billing_user_id', 'order_date']);
            $table->index(['seller_user_id', 'order_date']);
            $table->index(['db_product_id', 'order_date']);
            $table->index(['status', 'order_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_headers');
    }
};
