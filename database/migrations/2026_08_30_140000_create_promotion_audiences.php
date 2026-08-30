<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table): void {
            $table->string('audience_mode', 32)->default('selected')->after('visibility');
            $table->timestamp('audience_updated_at')->nullable()->after('audience_mode');
        });

        Schema::create('promotion_user', function (Blueprint $table): void {
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->primary(['promotion_id', 'user_id']);
            $table->index(['user_id', 'promotion_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_user');

        Schema::table('promotions', function (Blueprint $table): void {
            $table->dropColumn(['audience_mode', 'audience_updated_at']);
        });
    }
};
