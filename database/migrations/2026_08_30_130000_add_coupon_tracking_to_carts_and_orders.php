<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', function (Blueprint $table): void {
            $table->foreignId('promotion_coupon_id')->nullable()->after('discounts')->constrained('promotion_coupons')->nullOnDelete();
            $table->string('coupon_code', 64)->nullable()->after('promotion_coupon_id');
        });

        Schema::table('order_headers', function (Blueprint $table): void {
            $table->foreignId('promotion_coupon_id')->nullable()->after('discount_total_ht')->constrained('promotion_coupons')->nullOnDelete();
            $table->string('coupon_code', 64)->nullable()->after('promotion_coupon_id');
        });

        Schema::create('promotion_coupon_redemptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('promotion_coupon_id')->constrained('promotion_coupons')->cascadeOnDelete();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cart_id')->constrained()->cascadeOnDelete()->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('discount_amount_ht', 12, 2);
            $table->timestamp('used_at');
            $table->timestamps();

            $table->index(['promotion_coupon_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_coupon_redemptions');

        Schema::table('order_headers', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('promotion_coupon_id');
            $table->dropColumn('coupon_code');
        });

        Schema::table('carts', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('promotion_coupon_id');
            $table->dropColumn('coupon_code');
        });
    }
};
