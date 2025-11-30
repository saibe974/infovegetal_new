<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DbProducts;
use Illuminate\Http\JsonResponse;

class DbProductsController extends Controller
{
    /**
     * Retourne la liste des bases de produits disponibles
     */
    public function index(): JsonResponse
    {
        $dbProducts = DbProducts::select(['id', 'name', 'description'])
            ->orderBy('name')
            ->get();

        return response()->json($dbProducts);
    }
}
