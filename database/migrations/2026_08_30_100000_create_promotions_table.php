<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table): void {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('status', 32)->default('draft')->index();
            $table->string('visibility', 32)->default('targeted')->index();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('responsible_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('starts_at')->nullable()->index();
            $table->dateTime('ends_at')->nullable()->index();
            $table->dateTime('published_at')->nullable();
            $table->dateTime('suspended_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['responsible_user_id', 'status']);
            $table->index(['created_by_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotions');
    }
};
