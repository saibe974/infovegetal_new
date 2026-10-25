<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->json('workflow')->nullable();
            $table->unsignedInteger('revision')->default(0);
            $table->uuid('submission_key')->nullable()->unique();
        });
        Schema::create('order_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cart_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('author_role');
            $table->text('body');
            $table->timestamps();
        });
        Schema::create('order_issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cart_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->unsignedBigInteger('product_id');
            $table->string('kind');
            $table->unsignedInteger('quantity');
            $table->text('comment');
            $table->string('status')->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users');
            $table->text('resolution')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
        Schema::create('invoice_number_settings', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->string('pattern')->default('%annee%-%compteur%');
            $table->unsignedBigInteger('next_number')->default(1);
            $table->timestamps();
        });
        Schema::create('order_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cart_id')->constrained();
            $table->foreignId('issuer_id')->constrained('users');
            $table->string('kind');
            $table->string('number');
            $table->foreignId('invoice_id')->nullable()->constrained('order_documents');
            $table->json('snapshot');
            $table->timestamp('issued_at');
            $table->unique(['issuer_id', 'kind', 'number']);
            $table->index(['cart_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_documents');
        Schema::dropIfExists('invoice_number_settings');
        Schema::dropIfExists('order_issues');
        Schema::dropIfExists('order_comments');
        Schema::table('carts', function (Blueprint $table) {
            $table->dropUnique(['submission_key']);
            $table->dropColumn(['workflow', 'revision', 'submission_key']);
        });
    }
};
