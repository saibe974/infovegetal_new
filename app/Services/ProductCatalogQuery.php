<?php

namespace App\Services;

use App\Models\CategoryProducts;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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
        $producer = $multiValue('producer');
        $image = in_array($request->input('image'), ['with', 'without'], true)
            ? (string) $request->input('image')
            : null;
        $promo = $request->has('promo') ? $request->boolean('promo') : null;
        $letter = self::normalizeLetter($request->input('letter'));
        $categoryBranchIds = $categoryId
            ? CategoryProducts::descendantsAndSelf($categoryId)->pluck('id')->map(fn ($id) => (int) $id)->all()
            : [];

        $filters = [
            'category' => $categoryId,
            'category_branch_ids' => $categoryBranchIds,
            'country' => $country,
            'pot' => $pot,
            'height' => $height,
            'producer' => $producer,
            'image' => $image,
            'promo' => $promo,
            'letter' => $letter,
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

        if (! in_array('producer', $skip, true) && ! empty($filters['producer'])) {
            $q->where(function ($producerQuery) use ($filters) {
                $producerQuery
                    ->whereIn('producer_id', $filters['producer'])
                    ->orWhereHas('producer', function ($producer) use ($filters) {
                        $producer->whereIn('name', $filters['producer']);
                    });
            });
        }

        if (! in_array('image', $skip, true)) {
            $q->imageAvailability($filters['image']);
        }

        if (! in_array('promo', $skip, true) && $filters['promo'] !== null) {
            $method = $filters['promo'] ? 'where' : 'whereNot';
            $q->$method(function ($promoQuery) {
                $promoQuery->whereNotNull('price_promo')
                    ->where('price_promo', '>', 0)
                    ->where(function ($promoQuery) {
                        $promoQuery
                            ->whereNull('price_roll')
                            ->orWhereColumn('price_promo', '<>', 'price_roll');
                    });
            });
        }

        if (! in_array('letter', $skip, true) && ($filters['letter'] ?? null) !== null) {
            self::applyLetter($q, $filters['letter']);
        }
    }

    /** Lettre initiale acceptée : A-Z, ou « # » pour les noms ne commençant pas par une lettre. */
    public static function normalizeLetter(mixed $value): ?string
    {
        $value = is_string($value) ? trim($value) : '';

        return mb_strlen($value) === 1 ? self::initialOf($value) : null;
    }

    /** Initiale d'un nom, sans accent ni casse ; « # » si ce n'est pas une lettre. */
    public static function initialOf(?string $name): ?string
    {
        $first = mb_substr(trim((string) $name), 0, 1);
        if ($first === '') {
            return null;
        }

        $ascii = strtoupper(Str::ascii($first));

        return preg_match('/^[A-Z]$/', $ascii) ? $ascii : '#';
    }

    /**
     * Les collations MySQL *_ci ignorent casse et accents : « E% » couvre « é… ».
     * « # » regroupe les noms qui ne commencent par aucune lettre A-Z.
     */
    public static function applyLetter(Builder $q, string $letter): void
    {
        if ($letter !== '#') {
            $q->where('products.name', 'like', $letter.'%');

            return;
        }

        $q->whereNot(function ($letters) {
            foreach (range('A', 'Z') as $char) {
                $letters->orWhere('products.name', 'like', $char.'%');
            }
        });
    }

    /** Initiales disponibles sous les autres filtres (sans le filtre lettre lui-même). */
    public static function letterOptions(Builder $optionsBaseQuery, array $filters, callable $applyFilters): array
    {
        return (clone $optionsBaseQuery)
            ->tap(fn ($q) => $applyFilters($q, $filters, ['letter']))
            ->whereNotNull('products.name')
            ->selectRaw('DISTINCT SUBSTR(products.name, 1, 1) as initial')
            ->reorder()
            ->pluck('initial')
            ->map(fn ($initial) => self::initialOf((string) $initial))
            ->filter()
            ->unique()
            ->sort(fn ($a, $b) => ($a === '#') <=> ($b === '#') ?: strcmp($a, $b))
            ->values()
            ->all();
    }

    /** Available states under the other filters, excluding each facet's own selection. */
    public static function binaryFilterOptions(Builder $baseQuery, array $filters, callable $applyFilters): array
    {
        $options = [];
        foreach (['image' => ['with', 'without'], 'promo' => [true, false]] as $key => $states) {
            $options[$key] = [];
            foreach ($states as $state) {
                $query = clone $baseQuery;
                $applyFilters($query, array_replace($filters, [$key => $state]));
                if ($query->exists()) {
                    $options[$key][] = $state;
                }
            }
        }

        return $options;
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
