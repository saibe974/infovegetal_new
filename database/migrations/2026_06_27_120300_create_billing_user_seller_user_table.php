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
        Schema::create('billing_user_seller_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('billing_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('seller_user_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('active')->default(true);
            $table->json('conditions_override')->nullable();
            $table->timestamps();

            $table->unique(['billing_user_id', 'seller_user_id']);
            $table->index(['billing_user_id', 'active']);
            $table->index(['seller_user_id', 'active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('billing_user_seller_user');
    }
};
