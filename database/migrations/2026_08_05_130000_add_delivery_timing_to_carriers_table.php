<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carriers', function (Blueprint $table): void {
            $table->unsignedSmallInteger('minimum_delay_hours')->default(24)->after('days');
            $table->time('order_cutoff_time')->default('12:00:00')->after('minimum_delay_hours');
        });
    }

    public function down(): void
    {
        Schema::table('carriers', function (Blueprint $table): void {
            $table->dropColumn(['minimum_delay_hours', 'order_cutoff_time']);
        });
    }
};
