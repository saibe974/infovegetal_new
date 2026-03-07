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
            $table->string('alias', 255)->nullable()->after('name');
            $table->string('ref', 50)->nullable()->after('alias');
            $table->string('tel', 25)->nullable()->after('ref');

            $table->string('address_road', 255)->nullable()->after('tel');
            $table->string('address_zip', 32)->nullable()->after('address_road');
            $table->string('address_town', 120)->nullable()->after('address_zip');

            $table->boolean('active')->default(true)->after('address_town');
            $table->boolean('mailing')->default(false)->after('active');

            $table->unique('alias');
            $table->index('ref');
            $table->index('tel');
            $table->index('address_zip');
            $table->index('active');
            $table->index('mailing');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['alias']);
            $table->dropIndex(['ref']);
            $table->dropIndex(['tel']);
            $table->dropIndex(['address_zip']);
            $table->dropIndex(['active']);
            $table->dropIndex(['mailing']);

            $table->dropColumn([
                'alias',
                'ref',
                'tel',
                'address_road',
                'address_zip',
                'address_town',
                'active',
                'mailing',
            ]);
        });
    }
};
