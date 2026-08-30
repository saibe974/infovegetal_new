<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_mailings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('subject');
            $table->string('preheader')->nullable();
            $table->string('heading')->nullable();
            $table->text('body');
            $table->string('cta_label')->nullable();
            $table->text('cta_url')->nullable();
            $table->string('status', 24)->default('draft')->index();
            $table->dateTime('scheduled_at')->nullable()->index();
            $table->dateTime('snapshot_at')->nullable();
            $table->dateTime('started_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->unsignedInteger('recipient_count')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['promotion_id', 'status']);
        });

        Schema::create('promotion_mailing_recipients', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('promotion_mailing_id')->constrained('promotion_mailings')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('email_snapshot');
            $table->string('name_snapshot');
            $table->string('status', 24)->default('pending')->index();
            $table->string('skip_reason')->nullable();
            $table->text('error')->nullable();
            $table->dateTime('sent_at')->nullable();
            $table->timestamps();

            $table->unique(['promotion_mailing_id', 'user_id']);
            $table->index(['promotion_mailing_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_mailing_recipients');
        Schema::dropIfExists('promotion_mailings');
    }
};
