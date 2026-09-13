<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->string('disk')->nullable();
            $table->unsignedBigInteger('cart_id')->nullable()->index();
            $table->string('document_key', 100)->nullable();
            $table->date('document_date')->nullable()->index();
            $table->string('mime')->nullable();
            $table->unique(['user_id', 'cart_id', 'document_key'], 'files_order_owner_unique');
        });
    }

    public function down(): void
    {
        Schema::table('files', function (Blueprint $table) {
            $table->dropUnique('files_order_owner_unique');
            $table->dropIndex(['cart_id']);
            $table->dropIndex(['document_date']);
            $table->dropColumn(['disk', 'cart_id', 'document_key', 'document_date', 'mime']);
        });
    }
};
