<?php

namespace App\Services;

use App\Models\CategoryProducts;
use App\Models\DbProducts;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

final class PromotionProductCatalogService
{
    public function __construct(private readonly PromotionAuthorizationService $promotionAuthorization) {}

    public function selectableQuery(User $user): Builder
    {
        $actor = $this->promotionAuthorization->resolveActor($user);
        $query = Product::query()->where('active', true);

        if ($this->promotionAuthorization->canManageAll($actor)) {
            return $query;
        }

        $databaseIds = $actor->dbProducts()->pluck('db_products.id')
            ->merge($actor->sellerDbProducts()->wherePivot('active', true)->pluck('db_products.id'))
            ->merge($actor->billingDbProducts()->wherePivot('active', true)->pluck('db_products.id'))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        return $query->whereIn('db_products_id', $databaseIds->all());
    }

    public function filteredQuery(User $user, array $filters): Builder
    {
        $query = $this->applySearch($this->selectableQuery($user), $filters['q'] ?? null);

        return $this->applyFilters($query, $filters);
    }

    /**
     * Options de filtres recalculées selon les filtres actifs, chacune excluant
     * sa propre contrainte pour ne pas se verrouiller elle-même.
     *
     * @return array{categoryOptions: int[], countryOptions: string[], potOptions: string[], heightOptions: string[]}
     */
    public function filterOptions(User $user, array $filters): array
    {
        $base = $this->applySearch($this->selectableQuery($user), $filters['q'] ?? null);

        $categoryOptions = (clone $base)
            ->tap(fn (Builder $query) => $this->applyFilters($query, $filters, ['category']))
            ->whereNotNull('category_products_id')
            ->select('category_products_id')
            ->distinct()
            ->orderBy('category_products_id')
            ->pluck('category_products_id')
            ->map(fn ($value) => (int) $value)
            ->values()
            ->all();

        $countryOptions = (clone $base)
            ->tap(fn (Builder $query) => $this->applyFilters($query, $filters, ['country']))
            ->join('db_products', 'products.db_products_id', '=', 'db_products.id')
            ->whereNotNull('db_products.country')
            ->select('db_products.country')
            ->distinct()
            ->orderBy('db_products.country')
            ->pluck('db_products.country')
            ->map(fn ($value) => (string) $value)
            ->values()
            ->all();

        $potOptions = (clone $base)
            ->tap(fn (Builder $query) => $this->applyFilters($query, $filters, ['pot']))
            ->whereNotNull('pot')
            ->select('pot')
            ->distinct()
            ->orderBy('pot')
            ->pluck('pot')
            ->map(fn ($value) => (string) $value)
            ->values()
            ->all();

        $heightOptions = (clone $base)
            ->tap(fn (Builder $query) => $this->applyFilters($query, $filters, ['height']))
            ->whereNotNull('height')
            ->select('height')
            ->distinct()
            ->orderBy('height')
            ->pluck('height')
            ->map(fn ($value) => (string) $value)
            ->values()
            ->all();

        return [
            'categoryOptions' => $categoryOptions,
            'countryOptions' => $countryOptions,
            'potOptions' => $potOptions,
            'heightOptions' => $heightOptions,
        ];
    }

    public function databaseOptions(User $user): array
    {
        $ids = $this->selectableQuery($user)
            ->whereNotNull('db_products_id')
            ->distinct()
            ->pluck('db_products_id');

        return DbProducts::query()
            ->whereIn('id', $ids)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->toArray();
    }

    public function categoryOptions(User $user): array
    {
        $ids = $this->selectableQuery($user)
            ->whereNotNull('category_products_id')
            ->distinct()
            ->pluck('category_products_id');

        return CategoryProducts::query()
            ->whereIn('id', $ids)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->toArray();
    }

    private function applySearch(Builder $query, ?string $search): Builder
    {
        $search = trim((string) $search);

        if ($search === '') {
            return $query;
        }

        $tokens = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        foreach ($tokens as $token) {
            $query->where(function (Builder $searchQuery) use ($token): void {
                $searchQuery
                    ->where('name', 'like', '%'.$token.'%')
                    ->orWhere('ref', 'like', '%'.$token.'%')
                    ->orWhere('sku', 'like', '%'.$token.'%')
                    ->orWhere('ean13', 'like', '%'.$token.'%');
            });
        }

        return $query;
    }

    private function applyFilters(Builder $query, array $filters, array $skip = []): Builder
    {
        if (! in_array('database', $skip, true) && ! empty($filters['database'])) {
            $query->where('db_products_id', (int) $filters['database']);
        }

        if (! in_array('category', $skip, true) && ! empty($filters['category'])) {
            $categoryIds = CategoryProducts::descendantsAndSelf((int) $filters['category'])
                ->pluck('id');
            $query->whereIn('category_products_id', $categoryIds);
        }

        if (! in_array('availability', $skip, true)) {
            $moment = now();
            match ($filters['availability'] ?? 'all') {
                'available' => $query->orderableAt($moment),
                'upcoming' => $query->where('available_from', '>', $moment),
                'ended' => $query->whereNotNull('available_until')->where('available_until', '<', $moment),
                default => null,
            };
        }

        if (! in_array('country', $skip, true) && ! empty($filters['country'])) {
            $query->whereHas('dbProduct', fn (Builder $dbQuery) => $dbQuery->whereIn('country', $filters['country']));
        }

        if (! in_array('pot', $skip, true) && ! empty($filters['pot'])) {
            $query->whereIn('pot', $filters['pot']);
        }

        if (! in_array('height', $skip, true) && ! empty($filters['height'])) {
            $query->whereIn('height', $filters['height']);
        }

        if (! in_array('image', $skip, true)) {
            $query->imageAvailability($filters['image'] ?? null);
        }

        if (! in_array('promo', $skip, true) && ! empty($filters['promo'])) {
            $query->whereNotNull('price_promo')
                ->where('price_promo', '>', 0)
                ->where(function ($promoQuery) {
                    $promoQuery
                        ->whereNull('price_roll')
                        ->orWhereColumn('price_promo', '<>', 'price_roll');
                });
        }

        return $query;
    }
}