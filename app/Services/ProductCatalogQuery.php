<?php

namespace App\Services;

use App\Models\CategoryProducts;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/** Shared visibility, filters and ordering for the catalogue and its exports. */
class ProductCatalogQuery
{
    public readonly Builder $baseQuery;

    public readonly ?string $search;

    public readonly ?bool $activeFilter;

    public readonly array $filters;

    public function __construct(private readonly Request $request)
    {
        $baseQuery = Product::query();
        // Filtre panier (cart) - seulement appliqué si le paramètre ?cart=1 est présent
        if ($request->get('cart') === '1') {
            $cartIds = $request->session()->get('cart_filter_ids', []);
            $baseQuery->whereIn('products.id', is_array($cartIds) ? $cartIds : []);
        }

        $search = $request->get('q');

        $activeInput = $request->get('active');
        $activeFilter = null;

        $user = $request->user();
        $isImpersonated = $user && method_exists($user, 'isImpersonated') && $user->isImpersonated();
        $isAdminView = $user && $user->hasRole('admin') && ! $isImpersonated;

        if (! $isAdminView) {
            $baseQuery->orderableAt();
        }

        if ($user && ! $isAdminView) {
            $allowedDbIds = $user->dbProducts()->pluck('db_products.id')->toArray();
            $baseQuery->whereIn('db_products_id', $allowedDbIds);
        }

        if ($activeInput !== null && $activeInput !== '') {
            $activeFilter = match (strtolower((string) $activeInput)) {
                '1', 'true', 'yes', 'on', 'active' => true,
                '0', 'false', 'no', 'off', 'inactive' => false,
                default => null,
            };

            if ($activeFilter !== null) {
                $baseQuery->where('active', $activeFilter);
            }
        } else {
            $activeFilter = true;
            $baseQuery->where('active', true);
        }

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
        $categoryBranchIds = $categoryId
            ? CategoryProducts::descendantsAndSelf($categoryId)->pluck('id')->map(fn ($id) => (int) $id)->all()
            : [];

        $filters = [
            'category' => $categoryId,
            'category_branch_ids' => $categoryBranchIds,
            'country' => $country,
            'pot' => $pot,
            'height' => $height,
            'image' => $image,
            'promo' => $promo,
        ];

        $this->baseQuery = $baseQuery;
        $this->search = $search;
        $this->activeFilter = $activeFilter;
        $this->filters = $filters;
    }

    public function applySearch(Builder $q, ?string $search): void
    {
        if (empty($search)) {
            return;
        }

        $refCandidate = null;
        if (str_contains($search, ':')) {
            $refCandidate = trim((string) strtok($search, ':'));
            if ($refCandidate === '') {
                $refCandidate = null;
            }
        }

        if ($refCandidate) {
            $q->where('products.ref', '=', $refCandidate);

            return;
        }

        $normalized = trim($search);
        $tokens = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $isSingleNumeric = count($tokens) === 1 && ctype_digit($tokens[0]);
        $isSingleToken = count($tokens) === 1;

        $q->where(function ($qq) use ($tokens, $isSingleNumeric, $isSingleToken) {
            // Si un seul terme numerique, tenter l'ID exact
            if ($isSingleNumeric) {
                $qq->where('products.id', '=', (int) $tokens[0]);
            }

            // Et toujours proposer une recherche sur le nom qui contient tous les termes
            $qq->orWhere(function ($qqq) use ($tokens) {
                foreach ($tokens as $t) {
                    $qqq->where('products.name', 'like', '%'.$t.'%');
                }
            });

            if ($isSingleToken) {
                $qq->orWhere('products.ref', '=', $tokens[0]);
            }
        });
    }

    public function applyFilters(Builder $q, array $filters, array $skip = []): void
    {
        if (! in_array('category', $skip, true) && $filters['category']) {
            $q->whereIn('category_products_id', $filters['category_branch_ids']);
        }

        if (! in_array('country', $skip, true) && ! empty($filters['country'])) {
            $q->whereHas('dbProduct', function ($db) use ($filters) {
                $db->whereIn('country', $filters['country']);
            });
        }

        if (! in_array('pot', $skip, true) && ! empty($filters['pot'])) {
            $q->whereIn('pot', $filters['pot']);
        }

        if (! in_array('height', $skip, true) && ! empty($filters['height'])) {
            $q->whereIn('height', $filters['height']);
        }

        if (! in_array('image', $skip, true)) {
            $q->imageAvailability($filters['image']);
        }

        if (! in_array('promo', $skip, true) && $filters['promo']) {
            $q->whereNotNull('price_promo')
                ->where('price_promo', '>', 0)
                ->where(function ($promoQuery) {
                    $promoQuery
                        ->whereNull('price_roll')
                        ->orWhereColumn('price_promo', '<>', 'price_roll');
                });
        }
    }

    public function query(): Builder
    {
        $query = clone $this->baseQuery;
        $this->applySearch($query, $this->search);
        $this->applyFilters($query, $this->filters);

        if ($this->request->filled('sort')) {
            $query->orderFromRequest($this->request);
        } else {
            $query->orderBy('name');
        }

        return $query->orderBy('products.id');
    }
}
