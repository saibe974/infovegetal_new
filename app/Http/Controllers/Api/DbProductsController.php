<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DbProducts;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

class DbProductsController extends Controller
{
    /**
     * Retourne la liste des bases de produits disponibles
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = DbProducts::select(['id', 'name', 'description'])->orderBy('name');

        if ($user) {
            $canManageAll = $user->hasRole('admin')
                || $user->hasRole('dev')
                || $user->hasPermissionTo('users.db_products.manage.all');

            if (!$canManageAll) {
                $hasCanSell = Schema::hasColumn('db_products_users', 'can_sell');
                $query->whereHas('users', function ($q) use ($user, $hasCanSell) {
                    $q->where('users.id', (int) $user->id);
                    if ($hasCanSell) {
                        $q->where('db_products_users.can_sell', true);
                    }
                });
            }
        }

        $dbProducts = $query->get();

        return response()->json($dbProducts);
    }
}
