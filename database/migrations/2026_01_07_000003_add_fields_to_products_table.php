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
        Schema::table('products', function (Blueprint $table) {
            // Ajouter les colonnes de référence et code-barres
            $table->string('ref')->comment('Référence produit');
            $table->string('ean13')->comment('Code-barres EAN');
            
            // Colonnes pour la gestion des conditionnements
            $table->decimal('pot', 8, 2)->nullable()->comment('Format du pot (en cm, ml ou cl)');
            $table->string('height')->nullable()->comment('Hauteur du produit (en cm ou range)');
            
            // Colonnes de prix
            $table->decimal('price_floor', 12, 2)->nullable()->comment('Prix étage');
            $table->decimal('price_roll', 12, 2)->nullable()->comment('Prix roll');
            $table->decimal('price_promo', 12, 2)->nullable()->comment('Prix promo');
            
            $table->integer('cond')->nullable()->comment('conditionnement par carton');
            $table->integer('floor')->nullable()->comment('Quantité cartons par étage');
            $table->integer('roll')->nullable()->comment('Quantité étage par roll');

            // Clés étrangères
            $table->foreignId('producer_id')->nullable()->constrained('producers')->nullOnDelete();
            $table->foreignId('tva_id')->nullable()->constrained('tva')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeignKeyIfExists(['producer_id']);
            $table->dropForeignKeyIfExists(['tva_id']);
            $table->dropColumn([
                'ref',
                'ean13',
                'pot',
                'height',
                'price_floor',
                'price_roll',
                'price_promo',
                'producer_id',
                'cond',
                'floor',
                'roll',
            ]);
        });
    }
};
