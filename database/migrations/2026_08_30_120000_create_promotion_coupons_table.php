<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_coupons', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64)->unique();
            $table->string('discount_type', 20);
            $table->decimal('discount_value', 12, 2);
            $table->string('scope', 32)->default('promotion_products');
            $table->string('funded_by', 20)->default('seller');
            $table->decimal('minimum_order_ht', 12, 2)->default(0);
            $table->decimal('maximum_discount_ht', 12, 2)->nullable();
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('usage_limit_per_customer')->default(1);
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('ends_at')->nullable();
            $table->boolean('stackable_with_promo_price')->default(true);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['promotion_id', 'active']);
            $table->index(['starts_at', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_coupons');
    }
};
