<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_header_id')->constrained('order_headers')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('db_product_id')->nullable()->constrained('db_products')->nullOnDelete();
            $table->string('product_name');
            $table->string('product_ref')->nullable();
            $table->string('product_ean')->nullable();
            $table->unsignedBigInteger('producer_id')->nullable();
            $table->integer('quantity');
            $table->integer('cond')->nullable();
            $table->integer('floor')->nullable();
            $table->integer('roll')->nullable();
            $table->decimal('purchase_price', 14, 4)->default(0);
            $table->decimal('selling_price', 14, 4)->default(0);
            $table->decimal('transport_price', 14, 4)->default(0);
            $table->decimal('margin_amount', 14, 4)->default(0);
            $table->decimal('margin_percent', 8, 4)->nullable();
            $table->decimal('line_total_ht', 14, 2)->default(0);
            $table->decimal('line_total_tva', 14, 2)->default(0);
            $table->decimal('line_total_ttc', 14, 2)->default(0);
            $table->decimal('tva_rate', 5, 2)->nullable();
            $table->json('product_snapshot')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['order_header_id', 'db_product_id']);
            $table->index(['order_header_id', 'product_id']);
            $table->index(['db_product_id']);
            $table->index(['product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_lines');
    }
};
