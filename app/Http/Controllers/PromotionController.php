<?php

namespace App\Http\Controllers;

use App\Domain\Promotions\Enums\PromotionStatus;
use App\Domain\Promotions\Enums\PromotionVisibility;
use App\Http\Requests\Promotions\StorePromotionRequest;
use App\Http\Requests\Promotions\UpdatePromotionProductsRequest;
use App\Http\Requests\Promotions\UpdatePromotionRequest;
use App\Http\Resources\CategoryProductsResource;
use App\Models\CategoryProducts;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use App\Services\PromotionAuthorizationService;
use App\Services\PromotionProductCatalogService;
use App\Services\PromotionWorkspaceDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PromotionController extends Controller
{
    public function __construct(
        private readonly PromotionAuthorizationService $authorization,
        private readonly PromotionWorkspaceDataService $workspaceData,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Promotion::class);

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::enum(PromotionStatus::class)],
            'visibility' => ['nullable', Rule::enum(PromotionVisibility::class)],
        ]);

        $query = Promotion::query()
            ->with([
                'creator:id,name',
                'responsible:id,name',
            ])
            ->search($filters['q'] ?? null)
            ->latest('updated_at');

        $this->authorization->scopeVisible($request->user(), $query);

        if (! empty($filters['status'])) {
            $query->effectiveStatus(PromotionStatus::from($filters['status']));
        }

        if (! empty($filters['visibility'])) {
            $query->where('visibility', $filters['visibility']);
        }

        $collection = $query
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('promotions/index', [
            'collection' => $this->paginatedData(
                $collection,
                fn (Promotion $promotion) => $this->promotionData($promotion),
            ),
            'filters' => [
                'q' => $filters['q'] ?? '',
                'status' => $filters['status'] ?? '',
                'visibility' => $filters['visibility'] ?? '',
            ],
            'canCreate' => $request->user()->can('create', Promotion::class),
        ]);
    }

    public function create(Request $request): Response
    {
        $this->authorize('create', Promotion::class);

        return Inertia::render('promotions/general', [
            'promotion' => null,
            'managerOptions' => $this->managerOptions($request->user()),
        ]);
    }

    public function store(StorePromotionRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $actor = $this->authorization->resolveActor($request->user());
        $data['slug'] = $this->uniqueSlug($data['slug'] ?: $data['title']);
        $data['status'] = PromotionStatus::Draft;
        $data['created_by_id'] = $actor->id;

        $promotion = Promotion::create($data);

        return redirect()
            ->route('promotions.edit.general', $promotion)
            ->with('success', 'Promotion créée en brouillon.');
    }

    public function editGeneral(Request $request, Promotion $promotion): Response
    {
        $this->authorize('update', $promotion);
        $promotion->load(['creator:id,name', 'responsible:id,name']);

        return Inertia::render('promotions/general', [
            'promotion' => $this->promotionData($promotion),
            'managerOptions' => $this->managerOptions($request->user()),
        ]);
    }

    public function update(UpdatePromotionRequest $request, Promotion $promotion): RedirectResponse
    {
        $data = $request->validated();
        $data['slug'] = $data['slug'] ?: $this->uniqueSlug($data['title'], $promotion->id);

        $promotion->update($data);

        return back()->with('success', 'Informations générales enregistrées.');
    }

    public function editProducts(
        Request $request,
        Promotion $promotion,
        PromotionProductCatalogService $catalog,
    ): Response {
        $this->authorize('update', $promotion);

        $filters = $this->catalogFilters($request);

        $promotion->load([
            'creator:id,name',
            'responsible:id,name',
            'products' => fn ($query) => $query->with(['media', 'dbProduct:id,name', 'category:id,name']),
        ]);

        $productOptions = $catalog
            ->filteredQuery($request->user(), $filters)
            ->with(['media', 'dbProduct:id,name', 'category:id,name'])
            ->orderBy('name')
            ->paginate(18)
            ->withQueryString();

        $options = $catalog->filterOptions($request->user(), $filters);

        return Inertia::render('promotions/products', [
            'promotion' => $this->promotionData($promotion),
            'selectedProducts' => $promotion->products
                ->map(fn (Product $product) => $this->productData($product, true))
                ->values()
                ->all(),
            'productOptions' => $this->paginatedData(
                $productOptions,
                fn (Product $product) => $this->productData($product),
            ),
            'categories' => CategoryProductsResource::collection(
                CategoryProducts::query()
                    ->defaultOrder()
                    ->withDepth()
                    ->get(['id', 'name', 'parent_id', 'lft', 'rgt'])
            )->resolve(),
            'databaseOptions' => $catalog->databaseOptions($request->user()),
            'categoryOptions' => $options['categoryOptions'],
            'countryOptions' => $options['countryOptions'],
            'potOptions' => $options['potOptions'],
            'heightOptions' => $options['heightOptions'],
            'maxSelectedProducts' => Promotion::MAX_SELECTED_PRODUCTS,
            'filters' => [
                'q' => $filters['q'] ?? '',
                'database' => isset($filters['database']) ? (string) $filters['database'] : '',
                'category' => isset($filters['category']) ? (string) $filters['category'] : '',
                'availability' => $filters['availability'] ?? 'all',
                'country' => $filters['country'],
                'pot' => $filters['pot'],
                'height' => $filters['height'],
                'image' => $filters['image'],
                'promo' => $filters['promo'],
            ],
        ]);
    }

    public function updateProducts(
        UpdatePromotionProductsRequest $request,
        Promotion $promotion,
    ): RedirectResponse {
        $products = $request->validated('products');

        $syncData = [];
        foreach (array_values($products) as $position => $product) {
            $syncData[(int) $product['id']] = [
                'position' => $position,
                'featured' => (bool) $product['featured'],
                'show_before_availability' => (bool) $product['show_before_availability'],
                'custom_title' => ($product['custom_title'] ?? null) ?: null,
                'custom_description' => ($product['custom_description'] ?? null) ?: null,
            ];
        }

        DB::transaction(fn () => $promotion->products()->sync($syncData));

        return back()->with('success', 'Sélection de produits enregistrée.');
    }

    public function selectableProducts(
        Request $request,
        Promotion $promotion,
        PromotionProductCatalogService $catalog,
    ): JsonResponse {
        $this->authorize('update', $promotion);

        $filters = $this->catalogFilters($request);

        $query = $catalog
            ->filteredQuery($request->user(), $filters)
            ->with(['media', 'dbProduct:id,name', 'category:id,name'])
            ->orderBy('name');

        $total = (clone $query)->toBase()->count();

        if ($total > Promotion::MAX_SELECTED_PRODUCTS) {
            return response()->json([
                'message' => "Trop de produits correspondent aux filtres ({$total} sur un maximum de ".Promotion::MAX_SELECTED_PRODUCTS.'), affinez votre recherche.',
            ], 422);
        }

        return response()->json([
            'products' => $query
                ->get()
                ->map(fn (Product $product) => $this->productData($product))
                ->values()
                ->all(),
            'total' => $total,
        ]);
    }

    private function catalogFilters(Request $request): array
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'database' => ['nullable', 'integer', 'exists:db_products,id'],
            'category' => ['nullable', 'integer', 'exists:category_products,id'],
            'availability' => ['nullable', Rule::in(['all', 'available', 'upcoming', 'ended'])],
            'country' => ['nullable', 'array'],
            'country.*' => ['nullable', 'string', 'max:255'],
            'pot' => ['nullable', 'array'],
            'pot.*' => ['nullable', 'string', 'max:255'],
            'height' => ['nullable', 'array'],
            'height.*' => ['nullable', 'string', 'max:255'],
            'image' => ['nullable', Rule::in(['with', 'without'])],
            'promo' => ['nullable', 'boolean'],
        ]);

        $multiValue = fn (?array $values): array => array_values(array_unique(array_filter(
            array_map(fn ($value) => trim((string) $value), $values ?? []),
            fn ($value) => $value !== ''
        )));

        return [
            'q' => $validated['q'] ?? null,
            'database' => $validated['database'] ?? null,
            'category' => $validated['category'] ?? null,
            'availability' => $validated['availability'] ?? 'all',
            'country' => $multiValue($validated['country'] ?? null),
            'pot' => $multiValue($validated['pot'] ?? null),
            'height' => $multiValue($validated['height'] ?? null),
            'image' => $validated['image'] ?? null,
            'promo' => (bool) ($validated['promo'] ?? false),
        ];
    }

    private function promotionData(Promotion $promotion): array
    {
        return $this->workspaceData->for($promotion);
    }

    /**
     * Normalise un paginator au format PaginatedCollection attendu par le front,
     * identique à celui produit par un JsonResource sur paginator.
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  LengthAwarePaginator<TModel>  $paginator
     * @param  callable(TModel): array  $mapper
     */
    private function paginatedData(LengthAwarePaginator $paginator, callable $mapper): array
    {
        return [
            'data' => $paginator->getCollection()
                ->map($mapper)
                ->values()
                ->all(),
            'links' => [
                'first' => $paginator->url(1),
                'last' => $paginator->url($paginator->lastPage()),
                'prev' => $paginator->previousPageUrl(),
                'next' => $paginator->nextPageUrl(),
            ],
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'from' => $paginator->firstItem(),
                'last_page' => $paginator->lastPage(),
                'path' => $paginator->path(),
                'per_page' => $paginator->perPage(),
                'to' => $paginator->lastItem(),
                'total' => $paginator->total(),
                'links' => $paginator->linkCollection()->toArray(),
            ],
        ];
    }

    private function managerOptions(User $user): array
    {
        return $this->authorization
            ->eligibleManagers($user)
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $manager) => $manager->only(['id', 'name', 'email']))
            ->values()
            ->all();
    }

    private function productData(Product $product, bool $withSelection = false): array
    {
        $data = [
            'id' => $product->id,
            'name' => $product->name,
            'ref' => $product->ref,
            'sku' => $product->sku,
            'img_link' => $product->getFirstMediaUrl('images', 'thumb')
                ?: $product->getFirstMediaUrl('images')
                ?: $product->img_link,
            'active' => (bool) $product->active,
            'available_from' => $product->available_from?->format('Y-m-d\TH:i'),
            'available_until' => $product->available_until?->format('Y-m-d\TH:i'),
            'availability_status' => $product->availabilityStatusAt(),
            'database' => $product->dbProduct?->only(['id', 'name']),
            'category' => $product->category?->only(['id', 'name']),
        ];

        if ($withSelection) {
            $data['featured'] = (bool) $product->pivot?->featured;
            $data['show_before_availability'] = (bool) $product->pivot?->show_before_availability;
            $data['custom_title'] = $product->pivot?->custom_title;
            $data['custom_description'] = $product->pivot?->custom_description;
        }

        return $data;
    }

    private function uniqueSlug(string $source, ?int $ignoreId = null): string
    {
        $base = Str::slug($source) ?: 'promotion';
        $slug = $base;
        $suffix = 2;

        while (Promotion::query()
            ->when($ignoreId, fn ($query) => $query->where('id', '<>', $ignoreId))
            ->where('slug', $slug)
            ->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }
}
