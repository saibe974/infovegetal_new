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
        Schema::create('users_options', function (Blueprint $table) {
            $table->id();
            $table->string('key', 255);
            $table->string('value', 255)->nullable();
            $table->string('label', 255)->nullable();
            $table->string('type', 50)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['key', 'value']);
            $table->index(['key', 'active']);
            $table->index(['key', 'type']);
            $table->index('sort_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users_options');
    }
};
