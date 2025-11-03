<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_tag', function (Blueprint $t) {
            $t->unsignedBigInteger('product_id');
            $t->unsignedBigInteger('tag_id');
            $t->timestamps();

            $t->primary(['product_id', 'tag_id']);
            $t->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $t->foreign('tag_id')->references('id')->on('tags')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_tag');
    }
};
