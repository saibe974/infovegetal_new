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
        Schema::create('carrier_zones', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('carrier_id')->constrained('carriers')->cascadeOnDelete();
            $table->string('name');
            $table->json('tariffs')->nullable();
            $table->timestamps();

            $table->unique(['carrier_id', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('carrier_zones');
    }
};
