<?php

namespace App\Http\Controllers;

use App\Http\Resources\CategoryProductsResource;
use App\Http\Resources\ProductResource;
use App\Models\CategoryProducts;
use App\Models\Product;
use Illuminate\Http\Request;
use App\Http\Controllers\ProductController;

class HomeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $baseQuery = Product::query()->where('active', true);

        $user = $request->user();
        $isImpersonated = $user && method_exists($user, 'isImpersonated') && $user->isImpersonated();
        $isAdminView = $user && $user->hasRole('admin') && !$isImpersonated;

        if ($user && !$isAdminView) {
            $allowedDbIds = $user->dbProducts()->pluck('db_products.id')->toArray();
            $baseQuery->whereIn('db_products_id', $allowedDbIds);
        }

        $search = $request->get('q');

        $multiValue = function (string $key) use ($request): array {
            $values = $request->input($key, []);
            $values = is_array($values) ? $values : [$values];

            return array_values(array_unique(array_filter(
                array_map(fn ($value) => trim((string) $value), $values),
                fn ($value) => $value !== ''
            )));
        };

        $categoryId = $request->filled('category') ? (int) $request->input('category') : null;
        $country = $multiValue('country');
        $pot = $multiValue('pot');
        $height = $multiValue('height');
        $image = in_array($request->input('image'), ['with', 'without'], true)
            ? (string) $request->input('image')
            : null;
        $promo = $request->boolean('promo');

        $filters = [
            'category' => $categoryId,
            'country' => $country,
            'pot' => $pot,
            'height' => $height,
            'image' => $image,
            'promo' => $promo,
        ];

        $applyFilters = function ($q, array $filters, array $skip = []) {
            if (!in_array('category', $skip, true) && $filters['category']) {
                $q->where('category_products_id', $filters['category']);
            }

            if (!in_array('country', $skip, true) && !empty($filters['country'])) {
                $q->whereHas('dbProduct', function ($db) use ($filters) {
                    $db->whereIn('country', $filters['country']);
                });
            }

            if (!in_array('pot', $skip, true) && !empty($filters['pot'])) {
                $q->whereIn('pot', $filters['pot']);
            }

            if (!in_array('height', $skip, true) && !empty($filters['height'])) {
                $q->whereIn('height', $filters['height']);
            }

            if (!in_array('image', $skip, true)) {
                $q->imageAvailability($filters['image']);
            }

            if (!in_array('promo', $skip, true) && $filters['promo']) {
                $q->whereNotNull('price_promo')
                    ->where('price_promo', '>', 0)
                    ->where(function ($promoQuery) {
                        $promoQuery
                            ->whereNull('price_roll')
                            ->orWhereColumn('price_promo', '<>', 'price_roll');
                    });
            }
        };

        $optionsBaseQuery = clone $baseQuery;

        $categoryOptions = (clone $optionsBaseQuery)
            ->tap(fn ($q) => $applyFilters($q, $filters, ['category']))
            ->whereNotNull('category_products_id')
            ->select('category_products_id')
            ->distinct()
            ->orderBy('category_products_id')
            ->pluck('category_products_id')
            ->map(fn ($value) => (int) $value)
            ->values()
            ->all();

        $countryOptions = (clone $optionsBaseQuery)
            ->tap(fn ($q) => $applyFilters($q, $filters, ['country']))
            ->join('db_products', 'products.db_products_id', '=', 'db_products.id')
            ->whereNotNull('db_products.country')
            ->select('db_products.country')
            ->distinct()
            ->orderBy('db_products.country')
            ->pluck('db_products.country')
            ->map(fn ($value) => (string) $value)
            ->values()
            ->all();

        $potOptions = (clone $optionsBaseQuery)
            ->tap(fn ($q) => $applyFilters($q, $filters, ['pot']))
            ->whereNotNull('pot')
            ->select('pot')
            ->distinct()
            ->orderBy('pot')
            ->pluck('pot')
            ->map(fn ($value) => (string) $value)
            ->values()
            ->all();

        $heightOptions = (clone $optionsBaseQuery)
            ->tap(fn ($q) => $applyFilters($q, $filters, ['height']))
            ->whereNotNull('height')
            ->select('height')
            ->distinct()
            ->orderBy('height')
            ->pluck('height')
            ->map(fn ($value) => (string) $value)
            ->values()
            ->all();

        $query = (clone $baseQuery)
            ->with(['category', 'tags'])
            ->orderFromRequest($request);

        $applyFilters($query, $filters);


        return inertia('home', [
            'q' => $search,
            'collection' => inertia()->scroll(fn() => ProductResource::collection(
                (clone $query)->paginate(10)
            )),
            'searchPropositions' => inertia()->optional(fn() => ProductController::getSearchPropositions(clone $query, $search)),
            'filters' => [
                'active' => true,
                'category' => $categoryId,
                'country' => $country,
                'pot' => $pot,
                'height' => $height,
                'image' => $image,
                'promo' => $promo,
            ],
            'categories' => CategoryProductsResource::collection(
                CategoryProducts::query()
                    ->defaultOrder()
                    ->withDepth()
                    ->get(['id', 'name', 'parent_id', 'lft', 'rgt'])
            )->resolve(),
            'categoryOptions' => $categoryOptions,
            'countryOptions' => $countryOptions,
            'potOptions' => $potOptions,
            'heightOptions' => $heightOptions,
        ]);
    }

    public function documentation(Request $request)
    {
        
        return inertia('documentation', []);
    }

    public function legalNotices(Request $request)
    {
        
        return inertia('legals/legal-notices', []);
    }

    public function saleConditions(Request $request)
    {
        
        return inertia('legals/sale-conditions', []);
    }

    public function ourPolicy(Request $request)
    {
        
        return inertia('legals/our-policy', []);
    }
}
