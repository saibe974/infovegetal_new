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
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('_lft')->default(0)->after('id');
            $table->unsignedInteger('_rgt')->default(0)->after('_lft');
            $table->unsignedBigInteger('parent_id')->nullable()->after('_rgt');
            
            $table->index(['_lft', '_rgt', 'parent_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['_lft', '_rgt', 'parent_id']);
            $table->dropColumn(['_lft', '_rgt', 'parent_id']);
        });
    }
};
