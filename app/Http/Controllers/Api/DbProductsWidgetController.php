<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DbProductsResource;
use App\Models\DbProducts;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class DbProductsWidgetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $hasCanAccessColumn = Schema::hasColumn('db_product_user', 'can_access');
        $hasCanSellColumn = Schema::hasColumn('db_product_user', 'can_sell');
        $hasCanManageColumn = Schema::hasColumn('db_product_user', 'can_manage');

        $query = DbProducts::query()
            ->with([
                'users' => fn ($usersQuery) => $usersQuery
                    ->select('users.id')
                    ->when($user, fn ($q) => $q->where('users.id', (int) $user->id)),
            ])
            ->orderByDesc('updated_at');

        $canManageAll = $user
            && (
                $user->hasRole('admin')
                || $user->hasRole('dev')
                || $user->hasPermissionTo('users.db_products.manage.all')
            );

        if ($user && ! $canManageAll) {
            $query->whereHas('users', function ($q) use ($user, $hasCanAccessColumn, $hasCanSellColumn, $hasCanManageColumn) {
                $q->where('users.id', (int) $user->id)
                    ->where(function ($scope) use ($hasCanAccessColumn, $hasCanSellColumn, $hasCanManageColumn) {
                        if ($hasCanAccessColumn) {
                            $scope->orWhere('db_product_user.can_access', true);
                        }

                        if ($hasCanSellColumn) {
                            $scope->orWhere('db_product_user.can_sell', true);
                        }

                        if ($hasCanManageColumn) {
                            $scope->orWhere('db_product_user.can_manage', true);
                        }
                    });
            });
        }

        $search = trim((string) $request->get('q', ''));
        if ($search !== '') {
            $query->where('name', 'like', '%' . $search . '%');
        }

        $total = (clone $query)->count();
        $limit = min(50, max(1, (int) $request->get('limit', 8)));

        return response()->json([
            'items' => DbProductsResource::collection($query->limit($limit)->get())->resolve(),
            'total' => $total,
        ]);
    }
}
