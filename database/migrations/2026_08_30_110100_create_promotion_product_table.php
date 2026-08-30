<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_product', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->boolean('featured')->default(false);
            $table->boolean('show_before_availability')->default(false);
            $table->string('custom_title')->nullable();
            $table->text('custom_description')->nullable();
            $table->timestamps();

            $table->unique(['promotion_id', 'product_id']);
            $table->index(['promotion_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_product');
    }
};
