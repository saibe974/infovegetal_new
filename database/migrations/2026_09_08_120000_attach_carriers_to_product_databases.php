<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carrier_db_product', function (Blueprint $table) {
            $table->foreignId('carrier_id')->constrained()->cascadeOnDelete();
            $table->foreignId('db_product_id')->constrained('db_products')->cascadeOnDelete();
            $table->decimal('supplement_per_roll', 10, 2)->default(0);
            $table->primary(['carrier_id', 'db_product_id']);
        });

        // Preserve explicit assignments, including the commercial profiles used by clients.
        $carrierIds = DB::table('carriers')->pluck('id')->flip();
        $dbIds = DB::table('db_products')->pluck('id')->flip();
        $attach = function ($dbId, $raw) use ($carrierIds, $dbIds, &$attach): void {
            $attrs = is_string($raw) ? json_decode($raw, true) : $raw;
            if (! is_array($attrs) || ! $dbIds->has($dbId)) {
                return;
            }
            foreach ($attrs['profiles'] ?? [] as $profile) {
                $attach($dbId, $profile['conditions'] ?? []);
            }
            $choices = $attrs['t'] ?? [];
            if (is_string($choices)) {
                $choices = json_decode($choices, true);
            }
            if (is_numeric($choices)) {
                $choices = [['carrier_id' => (int) $choices]];
            }
            foreach (is_array($choices) ? $choices : [] as $choice) {
                $id = is_array($choice) ? (int) ($choice['carrier_id'] ?? 0) : 0;
                if ($carrierIds->has($id)) {
                    DB::table('carrier_db_product')->insertOrIgnore([
                        'carrier_id' => $id, 'db_product_id' => $dbId, 'supplement_per_roll' => 0,
                    ]);
                }
            }
        };
        foreach ([
            ['db_products', 'id', 'defaults'],
            ['db_product_user', 'db_product_id', 'attributes'],
            ['db_product_billing_user', 'db_product_id', 'defaults'],
            ['db_product_seller_user', 'db_product_id', 'conditions'],
            ['db_product_seller_user', 'db_product_id', 'seller_defaults'],
            ['client_sales_conditions', 'db_product_id', 'conditions_override'],
        ] as [$table, $id, $column]) {
            if (Schema::hasColumn($table, $column)) {
                foreach (DB::table($table)->select([$id, $column])->cursor() as $row) {
                    $attach($row->$id, $row->$column);
                }
            }
        }

        Schema::table('carriers', fn (Blueprint $table) => $table->dropColumn(['country', 'minimum']));
    }

    public function down(): void
    {
        Schema::table('carriers', function (Blueprint $table) {
            $table->string('country')->nullable();
            $table->unsignedInteger('minimum')->nullable();
        });
        Schema::dropIfExists('carrier_db_product');
    }
};
