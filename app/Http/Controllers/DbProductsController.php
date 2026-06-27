<?php

namespace App\Http\Controllers;

use App\Models\CategoryProducts;
use App\Models\DbProductBillingUser;
use App\Models\DbProducts;
use App\Http\Resources\DbProductsResource;
use App\Models\User;
use App\Services\ProductImportPreAnalyzer;
use App\Services\UserManagementAuthorizationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class DbProductsController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $hasCanSellColumn = Schema::hasColumn('db_product_user', 'can_sell');
        $search = $request->get('q');
        $query = DbProducts::query()->orderFromRequest($request);

        $canManageAll = $user
            && ($user->hasRole('admin') || $user->hasRole('dev') || $user->hasPermissionTo('users.db_products.manage.all'));

        if ($user && !$canManageAll) {
            $query->whereHas('users', function ($q) use ($user, $hasCanSellColumn) {
                $q->where('users.id', (int) $user->id)
                    ->when($hasCanSellColumn, fn ($qq) => $qq->where('db_product_user.can_sell', true));
            });
        }

        if ($search) {
            $query->where('name', 'like', '%' . $search . '%');
        }

        return Inertia::render('products/db-index', [
            'q' => $search,
            'collection' => Inertia::scroll(fn() => DbProductsResource::collection(
                $query->paginate(12)
            )),
            'searchPropositions' => Inertia::optional(fn() => $this->getSearchPropositions($query, $search)),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request)
    {
        return Inertia::render('products/db-edit', [
            'dbProduct' => [
                'id' => null,
                'name' => '',
                'description' => null,
                'champs' => [],
                'categories' => [],
                'traitement' => null,
                'header_row_index' => null,
                'source_delimiter' => null,
                'country' => null,
                'mod_liv' => null,
                'mini' => null,
                'billing_users' => [],
                'billable_user_ids' => [],
                'created_at' => null,
                'updated_at' => null,
            ],
            'categoryOptions' => $this->categoryOptions(),
            'eligibleUsers' => $this->eligibleUsers($request),
            'carriers' => $this->carrierOptions(),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $billableUserIds = $validated['billable_user_ids'] ?? [];
        $billingUsers = $validated['billing_users'] ?? [];
        unset($validated['billable_user_ids']);
        unset($validated['billing_users']);

        $dbProduct = DbProducts::create($validated);

        $this->syncBillableUsers($dbProduct, $billableUserIds);
        $this->syncDbProductBillingRules($dbProduct, $billingUsers);


        return redirect()->route('db-products.index')->with('success', __('Database created.'));
    }

    /**
     * Display the specified resource.
     */
    public function show(DbProducts $db_product)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Request $request, DbProducts $db_product)
    {
        $this->ensureCanManageDbProduct($request, $db_product);

        $hasCanSellColumn = Schema::hasColumn('db_product_user', 'can_sell');
        $db_product->load([
            'users' => fn ($query) => $query
                ->select('users.id')
                ->when($hasCanSellColumn, fn ($q) => $q->where('db_product_user.can_sell', true)),
            'billingRules' => fn ($query) => $query
                ->where('active', true)
                ->with([
                    'billingUser' => fn ($billingUserQuery) => $billingUserQuery
                        ->select('users.id', 'users.name', 'users.email')
                        ->with([
                            'sellers' => fn ($sellersQuery) => $sellersQuery
                                ->select('users.id', 'users.name', 'users.email')
                                ->wherePivot('active', true),
                        ]),
                ]),
        ]);

        return Inertia::render('products/db-edit', [
            'dbProduct' => DbProductsResource::make($db_product)->resolve(),
            'categoryOptions' => $this->categoryOptions(),
            'eligibleUsers' => $this->eligibleUsers($request),
            'carriers' => $this->carrierOptions(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, DbProducts $db_product)
    {
        $this->ensureCanManageDbProduct($request, $db_product);

        $validated = $this->validatePayload($request, $db_product);

        $billableUserIds = $validated['billable_user_ids'] ?? [];
        $billingUsers = $validated['billing_users'] ?? [];
        unset($validated['billable_user_ids']);
        unset($validated['billing_users']);

        $db_product->update($validated);
        $this->syncBillableUsers($db_product, $billableUserIds);
        $this->syncDbProductBillingRules($db_product, $billingUsers);

        return redirect()->route('db-products.index')->with('success', __('Database updated.'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(DbProducts $db_product)
    {
        $db_product->delete();

        return redirect()->route('db-products.index')->with('success', __('Database deleted.'));
    }

    public function analyzeSample(Request $request, ProductImportPreAnalyzer $analyzer)
    {
        $data = $request->validate([
            'id' => ['required', 'string'],
            'header_row_index' => ['nullable', 'integer', 'min:0'],
            'source_delimiter' => ['nullable', 'string', 'max:8'],
        ]);

        $state = Cache::get('import:' . $data['id'], []);
        if (!$state || empty($state['path'])) {
            return response()->json(['message' => 'Fichier exemple introuvable.'], 404);
        }

        $fullPath = Storage::path((string) $state['path']);
        if (!is_file($fullPath)) {
            return response()->json(['message' => 'Impossible d’accéder au fichier exemple.'], 400);
        }

        return response()->json($analyzer->analyze(
            $fullPath,
            isset($data['header_row_index']) ? (int) $data['header_row_index'] : null,
            $data['source_delimiter'] ?? null,
        ));
    }

    public function updateImportConfig(Request $request, DbProducts $db_product)
    {
        $this->ensureCanManageDbProduct($request, $db_product);

        $validated = $request->validate([
            'champs' => ['required', 'array'],
            'champs.*' => ['nullable', 'string'],
            'header_row_index' => ['required', 'integer', 'min:0'],
            'source_delimiter' => ['nullable', 'string', 'max:8'],
        ]);

        $db_product->update([
            'champs' => $validated['champs'],
            'header_row_index' => $validated['header_row_index'],
            'source_delimiter' => $validated['source_delimiter'] ?: null,
        ]);

        return response()->json([
            'message' => __('Import configuration updated.'),
            'dbProduct' => DbProductsResource::make($db_product->fresh())->resolve(),
        ]);
    }

    /**
     * Génère les propositions triées selon la logique de recherche.
     *
     * @param Builder<DbProducts> $query
     */
    private function getSearchPropositions(Builder $query, ?string $search): array
    {
        if (empty($search)) {
            return [];
        }

        $lowerSearch = mb_strtolower($search);

        // Récupération des noms distincts
        $suggestions = (clone $query)
            ->selectRaw('MIN(id) as id, name, MIN(created_at) as created_at')
            ->groupBy('name')
            ->pluck('name');
            // ->get();


        // --- 🧹 Nettoyage et déduplication ---
        $clean = function (string $str): string {
            $str = mb_strtolower($str);
            // garde uniquement lettres, espaces et tirets (supprime chiffres, /, etc.)
            $str = preg_replace('/[^\p{L}\s-]/u', ' ', $str);
            // espaces multiples → un seul
            $str = trim(preg_replace('/\s+/', ' ', $str));
            return $str;
        };

        // Applique le nettoyage
        $cleaned = $suggestions
            ->map(fn($name) => $clean($name))
            ->filter(fn($name) => !empty($name))
            ->unique()
            ->values();

        // --- 🔢 Tri selon priorités ---
        $items = $cleaned->all();

        usort($items, function ($a, $b) use ($lowerSearch) {
            // Priorité :
            // 1 = mot unique (sans espace ni tiret) qui commence par le terme
            // 2 = commence par le terme
            // 3 = contient le terme ailleurs
            // 4 = autres
            $pa = (
                !preg_match('/[-\s]/', $a) && str_starts_with($a, $lowerSearch)
            ) ? 1 : (
                str_starts_with($a, $lowerSearch) ? 2 : (
                str_contains($a, $lowerSearch) ? 3 : 4
            ));

            $pb = (
                !preg_match('/[-\s]/', $b) && str_starts_with($b, $lowerSearch)
            ) ? 1 : (
                str_starts_with($b, $lowerSearch) ? 2 : (
                str_contains($b, $lowerSearch) ? 3 : 4
            ));

            if ($pa !== $pb) return $pa <=> $pb;

            // Second critère : longueur
            $la = mb_strlen($a);
            $lb = mb_strlen($b);
            if ($la !== $lb) return $la <=> $lb;

            // Troisième : ordre alphabétique
            return strnatcmp($a, $b);
        });

        // dd($items);
        // Prend les 7 premiers
        return array_slice($items, 0, 7);
    }

    private function validatePayload(Request $request, ?DbProducts $dbProduct = null): array
    {
        return $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('db_products', 'name')->ignore($dbProduct?->id),
            ],
            'description' => ['nullable', 'string', 'max:500'],
            'champs' => ['nullable', 'array'],
            'champs.*' => ['nullable', 'string'],
            'categories' => ['nullable', 'array'],
            'categories.*' => ['nullable', 'string'],
            'traitement' => ['nullable', 'string', 'max:255'],
            'header_row_index' => ['nullable', 'integer', 'min:0'],
            'source_delimiter' => ['nullable', 'string', 'max:8'],
            'country' => ['nullable', 'string', 'size:2'],
            'mod_liv' => ['nullable', 'string', 'max:100'],
            'mini' => ['nullable', 'integer', 'min:0'],
            'billable_user_ids' => ['nullable', 'array'],
            'billable_user_ids.*' => ['integer', 'exists:users,id'],
            'billing_users' => ['nullable', 'array'],
            'billing_users.*.billing_user_id' => ['required', 'integer', 'exists:users,id'],
            'billing_users.*.defaults' => ['nullable', 'array'],
            'billing_users.*.sellers' => ['nullable', 'array'],
            'billing_users.*.sellers.*.seller_user_id' => ['required', 'integer', 'exists:users,id'],
            'billing_users.*.sellers.*.conditions_override' => ['nullable', 'array'],
        ]);
    }

    private function categoryOptions(): array
    {
        return CategoryProducts::query()
            ->select(['id', 'name'])
            ->orderBy('name')
            ->get()
            ->map(fn (CategoryProducts $category) => [
                'id' => (int) $category->id,
                'name' => (string) $category->name,
            ])
            ->values()
            ->all();
    }

    private function eligibleUsers(Request $request): array
    {
        $query = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['commercial', 'admin', 'dev']))
            ->orderBy('name');

        app(UserManagementAuthorizationService::class)
            ->scopeManageableUsers($request->user(), $query);

        return $query
            ->get(['id', 'name', 'email'])
            ->map(fn (User $user) => [
                'id' => (int) $user->id,
                'name' => (string) $user->name,
                'email' => (string) $user->email,
            ])
            ->values()
            ->all();
    }

    private function carrierOptions(): array
    {
        return \App\Models\Carrier::query()
            ->with(['zones:id,carrier_id,name'])
            ->orderBy('name')
            ->get(['id', 'name', 'country'])
            ->map(fn (\App\Models\Carrier $carrier) => [
                'id' => (int) $carrier->id,
                'name' => (string) $carrier->name,
                'country' => $carrier->country,
                'zones' => $carrier->zones
                    ->map(fn ($zone) => [
                        'id' => (int) $zone->id,
                        'carrier_id' => (int) $zone->carrier_id,
                        'name' => (string) $zone->name,
                    ])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }

    private function syncBillableUsers(DbProducts $dbProduct, array $billableUserIds): void
    {
        $selectedIds = collect($billableUserIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if (!empty($selectedIds)) {
            $attachPayload = [];
            foreach ($selectedIds as $selectedId) {
                $attachPayload[$selectedId] = [
                    'can_access' => true,
                    'can_buy' => false,
                    'can_invoice' => true,
                    'can_sell' => true,
                ];
            }
            $dbProduct->users()->syncWithoutDetaching($attachPayload);
        }

        $existingIds = $dbProduct->users()->pluck('users.id')->map(fn ($id) => (int) $id)->all();

        foreach ($existingIds as $existingId) {
            $dbProduct->users()->updateExistingPivot(
                $existingId,
                [
                    'can_access' => true,
                    'can_invoice' => in_array($existingId, $selectedIds, true),
                    'can_sell' => in_array($existingId, $selectedIds, true),
                ]
            );
        }
    }

    private function normalizeSalesConditions(?array $value): array
    {
        if (!$value) {
            return [];
        }

        $normalized = [];
        foreach ($value as $key => $item) {
            if (is_array($item)) {
                $normalized[$key] = $this->normalizeSalesConditions($item);
                continue;
            }

            $normalized[$key] = $item;
        }

        ksort($normalized);

        return $normalized;
    }

    private function syncDbProductBillingRules(DbProducts $dbProduct, array $billingUsers): void
    {
        $billingUsers = array_values(array_filter($billingUsers, fn ($rule) => is_array($rule) && !empty($rule['billing_user_id'])));

        $billingUserIds = [];

        foreach ($billingUsers as $rule) {
            $billingUserId = (int) $rule['billing_user_id'];
            $billingUserIds[] = $billingUserId;

            DbProductBillingUser::query()->updateOrCreate(
                [
                    'db_product_id' => (int) $dbProduct->id,
                    'billing_user_id' => $billingUserId,
                ],
                [
                    'defaults' => $this->normalizeSalesConditions($rule['defaults'] ?? []),
                    'active' => true,
                ]
            );

            $sellers = collect($rule['sellers'] ?? [])
                ->filter(fn ($seller) => is_array($seller) && !empty($seller['seller_user_id']))
                ->map(fn ($seller) => [
                    'seller_user_id' => (int) $seller['seller_user_id'],
                    'conditions_override' => $this->normalizeSalesConditions($seller['conditions_override'] ?? []),
                ])
                ->values();

            $sellerIds = $sellers->pluck('seller_user_id')->unique()->values()->all();

            $billingUser = User::query()->find($billingUserId);

            if (!$billingUser) {
                continue;
            }

            if (!empty($sellerIds)) {
                $activeRows = [];
                foreach ($sellerIds as $sellerId) {
                    $override = $sellers->firstWhere('seller_user_id', $sellerId)['conditions_override'] ?? [];
                    $activeRows[$sellerId] = [
                        'active' => true,
                        'conditions_override' => json_encode($override),
                    ];
                }

                $billingUser->sellers()->syncWithoutDetaching($activeRows);

                $billingUser->sellers()
                    ->whereNotIn('users.id', $sellerIds)
                    ->each(function (User $seller) use ($billingUserId): void {
                        DB::table('billing_user_seller_user')
                            ->where('billing_user_id', (int) $billingUserId)
                            ->where('seller_user_id', (int) $seller->id)
                            ->update(['active' => false, 'updated_at' => now()]);
                    });
            } else {
                DB::table('billing_user_seller_user')
                    ->where('billing_user_id', $billingUserId)
                    ->update(['active' => false, 'updated_at' => now()]);
            }
        }

        if (!empty($billingUserIds)) {
            DbProductBillingUser::query()
                ->where('db_product_id', (int) $dbProduct->id)
                ->whereNotIn('billing_user_id', $billingUserIds)
                ->update(['active' => false]);
        } else {
            DbProductBillingUser::query()
                ->where('db_product_id', (int) $dbProduct->id)
                ->update(['active' => false]);
        }
    }

    private function decodeJsonPivotAttributes(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }

    private function ensureCanManageDbProduct(Request $request, DbProducts $dbProduct): void
    {
        $user = $request->user();

        if (!$user) {
            abort(403, 'Unauthorized');
        }

        $canManageAll = $user->hasRole('admin')
            || $user->hasRole('dev')
            || $user->hasPermissionTo('users.db_products.manage.all');

        if ($canManageAll) {
            return;
        }

        if (!$user->hasPermissionTo('users.db_products.manage.his')) {
            abort(403, 'Unauthorized');
        }

        $relation = $user->dbProducts()->where('db_products.id', (int) $dbProduct->id);

        if (Schema::hasColumn('db_product_user', 'can_sell')) {
            $relation->where('db_product_user.can_sell', true);
        }

        if (!$relation->exists()) {
            abort(403, 'Unauthorized');
        }
    }
}
