<?php

namespace App\Http\Controllers;

use App\Models\CategoryProducts;
use App\Models\DbProductBillingUser;
use App\Models\DbProductSellerUser;
use App\Models\DbProducts;
use App\Http\Resources\DbProductsResource;
use App\Models\User;
use App\Services\ProductImportPreAnalyzer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Spatie\Permission\Exceptions\PermissionDoesNotExist;
use Inertia\Inertia;

class DbProductsController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $hasCanAccessColumn = Schema::hasColumn('db_product_user', 'can_access');
        $hasCanSellColumn = Schema::hasColumn('db_product_user', 'can_sell');
        $hasCanManageColumn = Schema::hasColumn('db_product_user', 'can_manage');
        $search = $request->get('q');
        $query = DbProducts::query()
            ->with([
                'users' => fn ($usersQuery) => $usersQuery
                    ->select('users.id')
                    ->when($user, fn ($q) => $q->where('users.id', (int) $user->id)),
            ])
            ->orderFromRequest($request);

        $canManageAll = $this->canManageAll($user);

        if ($user && !$canManageAll) {
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
                'created_at' => null,
                'updated_at' => null,
            ],
            'categoryOptions' => $this->categoryOptions(),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $dbProduct = DbProducts::create($validated);

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

        $db_product->load([
            'users' => fn ($query) => $query->select('users.id')->where('users.id', (int) $request->user()->id),
        ]);

        return Inertia::render('products/db-edit', [
            'dbProduct' => DbProductsResource::make($db_product)->resolve(),
            'categoryOptions' => $this->categoryOptions(),
        ]);
    }

    public function billing(Request $request, DbProducts $db_product)
    {
        $user = $request->user();
        if (!$user) {
            abort(403, 'Unauthorized');
        }

        $permissions = $this->resolveBillingPermissions($user, $db_product);

        if (!$permissions['can_view']) {
            abort(403, 'Unauthorized');
        }

        $db_product->load([
            'users' => fn ($query) => $query->select('users.id'),
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
                        'sellerRules' => fn ($query) => $query
                        ->where('active', true)
                        ->select('id', 'db_product_id', 'seller_user_id', 'billing_user_id', 'conditions', 'use_billing_profile', 'billing_profile_id', 'seller_defaults', 'can_manage', 'active'),
        ]);

                if (!$permissions['can_manage_all'] && !$permissions['is_db_manager']) {
            $filteredRules = $db_product->billingRules
                    ->filter(function (DbProductBillingUser $rule) use ($user) {
                    $billingUser = $rule->relationLoaded('billingUser') ? $rule->billingUser : null;

                    if (!$billingUser) {
                        return false;
                    }

                    if ((int) $billingUser->id === (int) $user->id) {
                        return true;
                    }

                    if (!$billingUser->relationLoaded('sellers')) {
                        return false;
                    }

                    return $billingUser->sellers->contains(fn (User $seller) => (int) $seller->id === (int) $user->id);
                })
                ->values();

            $db_product->setRelation('billingRules', $filteredRules);
        }

        return Inertia::render('products/db-billing', [
            'dbProduct' => DbProductsResource::make($db_product)->resolve(),
            'eligibleBillingUsers' => $permissions['can_manage_billing_users']
                ? $this->eligibleBillingUsers()
                : [],
            'eligibleSellerUsers' => $permissions['can_manage_sellers']
                ? $this->eligibleSellerUsers()
                : [],
            'carriers' => $this->carrierOptions(),
            'billingAbilities' => [
                'can_manage_billing_users' => $permissions['can_manage_billing_users'],
                'can_manage_sellers' => $permissions['can_manage_sellers'],
                'can_delegate_manage' => $permissions['can_delegate_manage'],
                'is_global_manager' => $permissions['can_manage_all'],
            ],
            'currentUserId' => (int) $user->id,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, DbProducts $db_product)
    {
        $this->ensureCanManageDbProduct($request, $db_product);

        $validated = $this->validatePayload($request, $db_product);

        $db_product->update($validated);

        return redirect()->route('db-products.index')->with('success', __('Database updated.'));
    }

    public function updateBilling(Request $request, DbProducts $db_product)
    {
        $user = $request->user();
        if (!$user) {
            abort(403, 'Unauthorized');
        }

        $permissions = $this->resolveBillingPermissions($user, $db_product);

        if (!$permissions['can_view']) {
            abort(403, 'Unauthorized');
        }

        $validated = $this->validateBillingPayload($request);
        $billingUsers = $this->sanitizeBillingPayload(
            $db_product,
            $user,
            $validated['billing_users'] ?? [],
            $permissions,
        );

        $billableUserIds = collect($billingUsers)
            ->map(fn ($rule) => (int) ($rule['billing_user_id'] ?? 0))
            ->filter(fn ($id) => $id > 0)
            ->values()
            ->all();

        $this->syncBillableUsers($db_product, $billableUserIds);
        $this->syncDbProductBillingRules($db_product, $billingUsers);

        return redirect()->route('db-products.billing', $db_product)->with('success', __('Billing rules updated.'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, DbProducts $db_product)
    {
        $this->ensureCanManageDbProduct($request, $db_product);

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
        ]);
    }

    private function validateBillingPayload(Request $request): array
    {
        return $request->validate([
            'billing_users' => ['nullable', 'array'],
            'billing_users.*.billing_user_id' => ['required', 'integer', 'exists:users,id'],
            'billing_users.*.defaults' => ['nullable', 'array'],
            'billing_users.*.sellers' => ['nullable', 'array'],
            'billing_users.*.sellers.*.seller_user_id' => ['required', 'integer', 'exists:users,id'],
            'billing_users.*.sellers.*.conditions' => ['nullable', 'array'],
            'billing_users.*.sellers.*.use_billing_profile' => ['nullable', 'boolean'],
            'billing_users.*.sellers.*.billing_profile_id' => ['nullable', 'string', 'max:190'],
            'billing_users.*.sellers.*.seller_defaults' => ['nullable', 'array'],
            'billing_users.*.sellers.*.can_manage' => ['nullable', 'boolean'],
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

    private function eligibleBillingUsers(): array
    {
        $query = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['admin', 'dev', 'commercial', 'seller', 'vendeur', 'facturant']))
            ->orderBy('name');

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

    private function eligibleSellerUsers(): array
    {
        return $this->eligibleBillingUsers();
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
                    'can_manage' => false,
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
                    'can_manage' => (bool) ($dbProduct->users()->where('users.id', $existingId)->first()?->pivot?->can_manage ?? false),
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
                    'conditions' => $this->normalizeSalesConditions($seller['conditions'] ?? []),
                    'use_billing_profile' => array_key_exists('use_billing_profile', $seller)
                        ? (bool) $seller['use_billing_profile']
                        : true,
                    'billing_profile_id' => !empty($seller['billing_profile_id'])
                        ? (string) $seller['billing_profile_id']
                        : null,
                    'seller_defaults' => array_key_exists('seller_defaults', $seller)
                        ? $this->normalizeSalesConditions(is_array($seller['seller_defaults'] ?? null) ? $seller['seller_defaults'] : [])
                        : null,
                    'can_manage' => (bool) ($seller['can_manage'] ?? false),
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
                    $activeRows[$sellerId] = [
                        'active' => true,
                    ];

                    $sellerRule = DbProductSellerUser::query()->firstOrNew([
                        'db_product_id' => (int) $dbProduct->id,
                        'seller_user_id' => (int) $sellerId,
                        'billing_user_id' => (int) $billingUserId,
                    ]);

                    $sellerRule->active = true;
                    $sellerRulePayload = $sellers->firstWhere('seller_user_id', $sellerId) ?? [];

                    $sellerRule->conditions = is_array($sellerRulePayload['conditions'] ?? null)
                        ? $sellerRulePayload['conditions']
                        : [];
                    $sellerRule->use_billing_profile = array_key_exists('use_billing_profile', $sellerRulePayload)
                        ? (bool) $sellerRulePayload['use_billing_profile']
                        : true;
                    $sellerRule->billing_profile_id = !empty($sellerRulePayload['billing_profile_id'])
                        ? (string) $sellerRulePayload['billing_profile_id']
                        : null;
                    $sellerRule->can_manage = (bool) ($sellerRulePayload['can_manage'] ?? false);

                    $incomingSellerDefaults = $sellerRulePayload['seller_defaults'] ?? null;

                    if (!$sellerRule->exists) {
                        $sellerRule->seller_defaults = is_array($incomingSellerDefaults) ? $incomingSellerDefaults : null;
                    } elseif (is_array($incomingSellerDefaults)) {
                        $sellerRule->seller_defaults = $incomingSellerDefaults;
                    }

                    $sellerRule->save();

                    // Ajout vendeur => acces + vente sur la DB; facturation toujours false pour commercial.
                    $dbProduct->users()->syncWithoutDetaching([
                        $sellerId => [
                            'can_access' => true,
                            'can_buy' => false,
                            'can_invoice' => false,
                            'can_sell' => true,
                            'can_manage' => (bool) $sellerRule->can_manage,
                        ],
                    ]);

                    $dbProduct->users()->updateExistingPivot($sellerId, [
                        'can_manage' => (bool) $sellerRule->can_manage,
                        'can_invoice' => false,
                        'updated_at' => now(),
                    ]);
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

                DbProductSellerUser::query()
                    ->where('db_product_id', (int) $dbProduct->id)
                    ->where('billing_user_id', (int) $billingUserId)
                    ->whereNotIn('seller_user_id', $sellerIds)
                    ->update(['active' => false, 'updated_at' => now()]);
            } else {
                DB::table('billing_user_seller_user')
                    ->where('billing_user_id', $billingUserId)
                    ->update(['active' => false, 'updated_at' => now()]);

                DbProductSellerUser::query()
                    ->where('db_product_id', (int) $dbProduct->id)
                    ->where('billing_user_id', (int) $billingUserId)
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

        $canManageAll = $this->canManageAll($user);

        if ($canManageAll) {
            return;
        }

        if (!$user->hasPermissionTo('users.db_products.manage.his')) {
            abort(403, 'Unauthorized');
        }

        if (!$this->canManageDbProduct($user, $dbProduct)) {
            abort(403, 'Unauthorized');
        }
    }

    private function canManageAll(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        return $user->hasRole('admin')
            || $user->hasRole('dev')
            || $user->hasPermissionTo('users.db_products.manage.all');
    }

    private function canManageDbProduct(User $user, DbProducts $dbProduct): bool
    {
        $relation = $user->dbProducts()->where('db_products.id', (int) $dbProduct->id);

        if (Schema::hasColumn('db_product_user', 'can_manage')) {
            $relation->where('db_product_user.can_manage', true);
        }

        return $relation->exists();
    }

    private function resolveBillingPermissions(User $user, DbProducts $dbProduct): array
    {
        $canManageAll = $this->canManageAll($user);
        $isDbManager = $this->canManageDbProduct($user, $dbProduct);

        $isBillingUser = DbProductBillingUser::query()
            ->where('db_product_id', (int) $dbProduct->id)
            ->where('billing_user_id', (int) $user->id)
            ->where('active', true)
            ->exists();

        $isSeller = DB::table('db_product_billing_user as dbu')
            ->join('billing_user_seller_user as bs', 'bs.billing_user_id', '=', 'dbu.billing_user_id')
            ->where('dbu.db_product_id', (int) $dbProduct->id)
            ->where('dbu.active', true)
            ->where('bs.seller_user_id', (int) $user->id)
            ->where('bs.active', true)
            ->exists();

        if (!$isSeller) {
            $isSeller = DbProductSellerUser::query()
                ->where('db_product_id', (int) $dbProduct->id)
                ->where('seller_user_id', (int) $user->id)
                ->where('active', true)
                ->exists();
        }

        $canManageSellersByPermission = $this->hasPermissionSafe($user, 'db_products.billing.manage_sellers');
        $canDelegateByPermission = $this->hasPermissionSafe($user, 'db_products.billing.delegate_manage');

        $canManageSellers = $canManageAll || $isDbManager || $isBillingUser || $canManageSellersByPermission;
        $canDelegateManage = $canManageAll || $isDbManager || $canDelegateByPermission;

        return [
            'can_manage_all' => $canManageAll,
            'is_db_manager' => $isDbManager,
            'is_billing_user' => $isBillingUser,
            'is_seller' => $isSeller,
            'can_view' => $canManageAll || $isDbManager || $isBillingUser || $isSeller,
            'can_manage_billing_users' => $canManageAll || $isDbManager,
            'can_manage_sellers' => $canManageSellers,
            'can_delegate_manage' => $canDelegateManage,
        ];
    }

    private function sanitizeBillingPayload(DbProducts $dbProduct, User $actor, array $billingUsers, array $permissions): array
    {
        if ($permissions['can_manage_billing_users']) {
            return $billingUsers;
        }

        $allowedBillingUserIds = DbProductBillingUser::query()
            ->where('db_product_id', (int) $dbProduct->id)
            ->where('active', true)
            ->where(function ($q) use ($actor) {
                $q->where('billing_user_id', (int) $actor->id)
                    ->orWhereExists(function ($sub) use ($actor) {
                        $sub->selectRaw('1')
                            ->from('billing_user_seller_user as bs')
                            ->whereColumn('bs.billing_user_id', 'db_product_billing_user.billing_user_id')
                            ->where('bs.seller_user_id', (int) $actor->id)
                            ->where('bs.active', true);
                    });
            })
            ->pluck('billing_user_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $allowedSet = array_fill_keys($allowedBillingUserIds, true);

        return collect($billingUsers)
            ->filter(fn ($rule) => is_array($rule) && isset($allowedSet[(int) ($rule['billing_user_id'] ?? 0)]))
            ->map(function ($rule) use ($dbProduct, $permissions, $actor) {
                $billingUserId = (int) $rule['billing_user_id'];

                $existingSellers = DbProductSellerUser::query()
                    ->where('db_product_id', (int) $dbProduct->id)
                    ->where('billing_user_id', $billingUserId)
                    ->where('active', true)
                    ->get()
                    ->keyBy('seller_user_id');

                $filteredSellers = collect($rule['sellers'] ?? [])
                    ->filter(fn ($seller) => is_array($seller) && !empty($seller['seller_user_id']))
                    ->map(function ($seller) use ($permissions, $actor, $existingSellers) {
                        $sellerId = (int) $seller['seller_user_id'];

                        // Un commercial non manager ne peut modifier que ses propres conditions.
                        // Les autres commerciaux existants sont conservés sans modification.
                        if (!$permissions['can_manage_sellers'] && $sellerId !== (int) $actor->id) {
                            $existing = $existingSellers->get($sellerId);
                            if (!$existing) {
                                return null;
                            }

                            return [
                                'seller_user_id' => $sellerId,
                                'conditions' => $existing->conditions ?? [],
                                'use_billing_profile' => $existing->use_billing_profile ?? true,
                                'billing_profile_id' => $existing->billing_profile_id ?? null,
                                'seller_defaults' => $existing->seller_defaults,
                                'can_manage' => $existing->can_manage ?? false,
                            ];
                        }

                        return [
                            'seller_user_id' => $sellerId,
                            'conditions' => is_array($seller['conditions'] ?? null) ? $seller['conditions'] : [],
                            'use_billing_profile' => array_key_exists('use_billing_profile', $seller)
                                ? (bool) $seller['use_billing_profile']
                                : true,
                            'billing_profile_id' => !empty($seller['billing_profile_id']) ? (string) $seller['billing_profile_id'] : null,
                            'seller_defaults' => array_key_exists('seller_defaults', $seller) && is_array($seller['seller_defaults'])
                                ? $seller['seller_defaults']
                                : null,
                            'can_manage' => $permissions['can_delegate_manage'] ? (bool) ($seller['can_manage'] ?? false) : false,
                        ];
                    })
                    ->filter()
                    ->values()
                    ->all();

                // Inclure les vendeurs existants qui n'ont pas été envoyés par le client
                // pour éviter la désactivation des vendeurs que l'utilisateur ne peut pas gérer.
                $incomingIds = collect($filteredSellers)->pluck('seller_user_id')->map(fn ($id) => (int) $id)->all();
                foreach ($existingSellers as $sellerId => $existing) {
                    if (!in_array($sellerId, $incomingIds, true)) {
                        $filteredSellers[] = [
                            'seller_user_id' => $sellerId,
                            'conditions' => $existing->conditions ?? [],
                            'use_billing_profile' => $existing->use_billing_profile ?? true,
                            'billing_profile_id' => $existing->billing_profile_id ?? null,
                            'seller_defaults' => $existing->seller_defaults,
                            'can_manage' => $existing->can_manage ?? false,
                        ];
                    }
                }

                return [
                    'billing_user_id' => $billingUserId,
                    'defaults' => is_array($rule['defaults'] ?? null) ? $rule['defaults'] : [],
                    'sellers' => $filteredSellers,
                ];
            })
            ->values()
            ->all();
    }

    private function hasPermissionSafe(User $user, string $permissionName): bool
    {
        try {
            return $user->hasPermissionTo($permissionName);
        } catch (PermissionDoesNotExist $e) {
            return false;
        }
    }
}
