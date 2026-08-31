<?php

namespace App\Http\Controllers;

use App\Http\Requests\FormProductRequest;
use App\Http\Resources\CategoryProductsResource;
use App\Http\Resources\ProductResource;
use App\Models\Carrier;
use App\Models\CategoryProducts;
use App\Models\Product;
use App\Services\ProductCatalogQuery;
use App\Services\ProductExportService;
use App\Services\ProductImportService;
use App\Services\ProductMediaService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use League\Csv\Reader;

class ProductController extends Controller
{
    /**
     * Sauvegarde le panier en session pour le filtrage.
     */
    public function saveCartToSession(Request $request)
    {
        $data = $request->validate([
            'cart_ids' => 'array',
            'cart_ids.*' => 'integer|min:1',
        ]);

        // Sauvegarder les IDs du panier en session
        $request->session()->put('cart_filter_ids', $data['cart_ids'] ?? []);

        return response()->json(['status' => 'ok']);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $catalog = new ProductCatalogQuery($request);
        $baseQuery = $catalog->baseQuery;
        $search = $catalog->search;
        $activeFilter = $catalog->activeFilter;
        $filters = $catalog->filters;
        $categoryId = $filters['category'];
        $country = $filters['country'];
        $pot = $filters['pot'];
        $height = $filters['height'];
        $image = $filters['image'];
        $promo = $filters['promo'];
        $applySearch = $catalog->applySearch(...);
        $applyFilters = $catalog->applyFilters(...);

        $optionsBaseQuery = clone $baseQuery;
        $applySearch($optionsBaseQuery, $search);

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

        $query = $catalog->query()->with(['category', 'tags', 'dbProduct']);

        $products = $query->paginate(24);
        $user = $request->user();
        $dbUserAttributesByDbId = [];
        $dbUserTransportByDbId = [];

        if ($user) {
            $userDbProducts = $user->dbProducts()->get();
            foreach ($userDbProducts as $dbProduct) {
                $pivotAttributes = $dbProduct->pivot?->attributes;
                if (! $pivotAttributes) {
                    continue;
                }

                $decoded = is_string($pivotAttributes)
                    ? json_decode($pivotAttributes, true)
                    : $pivotAttributes;

                if (is_array($decoded)) {
                    $dbUserAttributesByDbId[(int) $dbProduct->id] = $decoded;
                }
            }

            $carrierIds = [];
            $zoneIds = [];
            foreach ($dbUserAttributesByDbId as $attrs) {
                $transportChoice = ProductResource::resolveTransportChoiceFromAttributes($attrs);
                $carrierId = $transportChoice['carrier_id'];
                $zoneId = $transportChoice['zone_id'];

                if ($carrierId > 0 && $zoneId > 0) {
                    $carrierIds[] = $carrierId;
                    $zoneIds[] = $zoneId;
                }
            }

            if (! empty($carrierIds) && ! empty($zoneIds)) {
                $carrierIds = array_values(array_unique($carrierIds));
                $zoneIds = array_values(array_unique($zoneIds));

                $carriers = Carrier::query()
                    ->whereIn('id', $carrierIds)
                    ->with([
                        'zones' => fn ($q) => $q
                            ->whereIn('id', $zoneIds)
                            ->select(['id', 'carrier_id', 'name', 'tariffs']),
                    ])
                    ->get(['id', 'taxgo']);

                $zoneMap = [];
                foreach ($carriers as $carrier) {
                    foreach ($carrier->zones as $zone) {
                        $zoneMap[$carrier->id.':'.$zone->id] = [
                            'carrier_id' => (int) $carrier->id,
                            'zone_id' => (int) $zone->id,
                            'zone_name' => (string) ($zone->name ?? ''),
                            'taxgo' => (float) ($carrier->taxgo ?? 0),
                            'tariffs' => is_array($zone->tariffs) ? $zone->tariffs : [],
                        ];
                    }
                }

                foreach ($dbUserAttributesByDbId as $dbId => $attrs) {
                    $transportChoice = ProductResource::resolveTransportChoiceFromAttributes($attrs);
                    $carrierId = $transportChoice['carrier_id'];
                    $zoneId = $transportChoice['zone_id'];

                    if ($carrierId <= 0 || $zoneId <= 0) {
                        continue;
                    }

                    $key = $carrierId.':'.$zoneId;
                    if (isset($zoneMap[$key])) {
                        $dbUserTransportByDbId[(int) $dbId] = $zoneMap[$key];
                    }
                }
            }
        }

        // Les prix sont calculés dans ProductResource (toArray) pour éviter un double calcul.
        if ($user) {
            $products->getCollection()->transform(function ($product) use ($dbUserAttributesByDbId, $dbUserTransportByDbId) {
                $dbId = $product->db_products_id;
                if ($dbId) {
                    $product->setAttribute('db_user_attributes', $dbUserAttributesByDbId[(int) $dbId] ?? null);
                    $product->setAttribute('db_user_transport', $dbUserTransportByDbId[(int) $dbId] ?? null);
                }

                return $product;
            });
        }

        $dbProducts = \App\Models\DbProducts::select(['id', 'name', 'description', 'country'])->orderBy('name')->get();

        return Inertia::render('products/index', [
            'q' => $search,
            'exportOptions' => ProductExportService::options(),
            'collection' => Inertia::scroll(fn () => ProductResource::collection($products)),
            'filters' => [
                'active' => $activeFilter,
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
            'dbProducts' => $dbProducts,
            'categoryOptions' => $categoryOptions,
            'countryOptions' => $countryOptions,
            'potOptions' => $potOptions,
            'heightOptions' => $heightOptions,
            'searchPropositions' => Inertia::optional(fn () => $this->getSearchPropositions(
                tap(clone $baseQuery, fn ($q) => $applyFilters($q, $filters)),
                $search
            )),
        ]);

    }

    /**
     * Traite le fichier CSV précédemment uploadé (calcul progress côté cache).
     */
    public function importProcess(Request $request, ProductImportService $importService)
    {
        $data = $request->validate([
            'id' => 'required|string',
            'db_products_id' => 'nullable|integer|min:1',
        ]);
        $id = $data['id'];

        $state = Cache::get("import:$id", []);
        $dbProductsId = isset($data['db_products_id'])
            ? (int) $data['db_products_id']
            : ((isset($state['db_products_id']) && is_numeric($state['db_products_id']) && (int) $state['db_products_id'] > 0)
                ? (int) $state['db_products_id']
                : null);

        $this->authorizeImportDb($request, $dbProductsId);

        if (! $state || empty($state['path'])) {
            return response()->json(['message' => 'Import inconnu'], 404);
        }

        $path = $state['path'];
        $fullPath = Storage::path($path);

        if (! is_string($fullPath) || ! is_file($fullPath)) {
            return response()->json(['message' => "Impossible d'accéder au fichier importé"], 400);
        }

        $relativePath = $path;

        // IMPORTANT: Mettre db_products_id dans le cache AVANT splitIntoTempFiles
        $this->updateImportState($id, [
            'status' => 'processing',
            'processed' => 0,
            'total' => 0,
            'errors' => 0,
            'progress' => 0,
            'current' => null,
            'report' => null,
            'path' => $relativePath,
            'next_offset' => 0,
            'has_more' => true,
            'db_products_id' => $dbProductsId, // Crucial pour le mapping dans splitIntoTempFiles
        ]);

        // Log::info("Import started synchronously for ID: $id with db_products_id: $dbProductsId");

        // Premier chunk synchronisé via le service (chunk index 0)
        $importService->run($id, $fullPath, $relativePath);

        // on renvoie l'état final du cache
        $final = Cache::get("import:$id") ?? [
            'status' => 'done',
            'processed' => 0,
            'total' => 0,
            'errors' => 0,
            'progress' => 100,
        ];

        return response()->json($final);
    }

    public function importProcessChunk(Request $request, ProductImportService $importService)
    {
        $data = $request->validate([
            'id' => 'required|string',
        ]);

        $id = $data['id'];

        $state = Cache::get("import:$id");
        if (! $state || empty($state['path'])) {
            return response()->json(['message' => 'Import inconnu'], 404);
        }

        $this->authorizeImportDb($request, isset($state['db_products_id']) ? (int) $state['db_products_id'] : null);

        $path = $state['path'];
        $fullPath = Storage::path($path);

        if (! is_string($fullPath) || ! is_file($fullPath)) {
            return response()->json(['message' => "Impossible d'accéder au fichier importé"], 400);
        }

        $relativePath = $path;
        $chunkIndex = isset($state['next_offset']) ? (int) $state['next_offset'] : 0;

        // Log::info("Import chunk requested for ID: $id at chunk index $chunkIndex");

        $importService->runChunk($id, $relativePath, $chunkIndex);

        $final = Cache::get("import:$id") ?? [
            'status' => 'done',
            'processed' => 0,
            'total' => 0,
            'errors' => 0,
            'progress' => 100,
        ];

        return response()->json($final);
    }

    /**
     * Renvoie la progression (upload/processing/done) pour l'id d'import.
     */
    public function importProgress(string $id)
    {
        $progress = Cache::get("import:$id");

        if ($progress) {
            $this->authorizeImportDb(request(), isset($progress['db_products_id']) ? (int) $progress['db_products_id'] : null);
        }

        if (! $progress) {
            return response()->json(['status' => 'waiting', 'progress' => 0]);
        }

        return response()->json([
            'status' => $progress['status'] ?? 'processing',
            'processed' => $progress['processed'] ?? 0,
            'total' => $progress['total'] ?? 0,
            'errors' => $progress['errors'] ?? 0,
            'current' => $progress['current'] ?? null,
            'progress' => $progress['progress'] ?? null,
            'report' => $progress['report'] ?? null,
            'next_offset' => $progress['next_offset'] ?? null,
            'has_more' => $progress['has_more'] ?? false,
        ]);
    }

    /**
     * Télécharge le rapport d'erreurs CSV pour un import donné.
     */
    public function importReport(string $id)
    {
        $state = Cache::get("import:$id");
        if ($state) {
            $this->authorizeImportDb(request(), isset($state['db_products_id']) ? (int) $state['db_products_id'] : null);
        }

        $reportPath = 'imports/reports/'.$id.'.csv';
        if (! Storage::exists($reportPath)) {
            return response()->json(['message' => 'Rapport introuvable'], 404);
        }

        $full = Storage::path($reportPath);
        $filename = 'import_report_'.$id.'.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($full) {
            $h = fopen($full, 'r');
            while (! feof($h)) {
                echo fread($h, 8192);
            }
            fclose($h);
        };

        return new StreamedResponse($callback, 200, $headers);
    }

    /**
     * Demande d'annulation de l'import en cours.
     */
    public function importCancel(Request $request)
    {
        $data = $request->validate([
            'id' => ['required', 'string'],
        ]);
        $id = $data['id'];
        $state = Cache::get("import:$id", []);
        $this->authorizeImportDb($request, isset($state['db_products_id']) ? (int) $state['db_products_id'] : null);

        Cache::put("import:$id:cancel", true, now()->addHour());
        Cache::put("import:$id", array_merge($state, ['status' => 'cancelling']), now()->addHour());

        return response()->json(['status' => 'cancelling']);
    }

    public function export(Request $request, ProductExportService $exporter)
    {
        Gate::authorize('manage-products');

        return $exporter->download($request);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(FormProductRequest $request)
    {
        // Log::info('[STORE] Method called - Request data:', ['data' => $request->all()]);

        $data = $request->validated();
        $data['ref'] = $data['ref'] ?? '';
        $data['ean13'] = $data['ean13'] ?? '';

        // Log::info("[STORE] Creating new product with validated data:", $data);

        $product = Product::create($data);
        $this->handleFormRequest($product, $request);
        app(ProductMediaService::class)->syncFromImgLink(
            $product,
            $data['img_link'] ?? $product->getRawOriginal('img_link')
        );

        // Log::info("[STORE] Product created with ID: {$product->id}");

        return redirect()->route('products.admin.edit', $product)->with('success', 'Produit créé');
    }

    /**
     * Display the specified resource.
     */
    public function show(Product $product)
    {
        $user = request()->user();
        $isImpersonated = $user && method_exists($user, 'isImpersonated') && $user->isImpersonated();
        $isAdminView = $user && $user->hasRole('admin') && ! $isImpersonated;

        abort_unless($isAdminView || $product->isOrderableAt(), 404);

        $product->load(['category', 'tags']);

        return Inertia::render('products/show', [
            'product' => new ProductResource($product),
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Product $product)
    {
        $product->load(['tags']);

        return Inertia::render('products/form', [
            'product' => new ProductResource($product),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(FormProductRequest $request, Product $product)
    {
        // Log::info('[UPDATE] Method called - Product ID: ' . $product->id . ' - Request data:', ['data' => $request->all()]);

        $data = $request->validated();
        $data['ref'] = $data['ref'] ?? '';
        $data['ean13'] = $data['ean13'] ?? '';

        // Log::info("[UPDATE] Updating product ID {$product->id} with validated data:", $data);

        $product->update($data);
        $this->handleFormRequest($product, $request);
        app(ProductMediaService::class)->syncFromImgLink(
            $product,
            $data['img_link'] ?? $product->getRawOriginal('img_link')
        );

        // Log::info("[UPDATE] Product {$product->id} updated successfully");

        return redirect()->back()->with('success', 'Produit mis à jour');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Product $product)
    {
        $product->delete();

        return redirect()->back()->with('success', 'Produit supprimé');
    }

    private function handleFormRequest(Product $product, FormProductRequest $request)
    {
        // Synchronisation des tags si fournis
        $raw = $request->input('tags');
        if ($raw !== null) {
            $names = [];
            if (is_array($raw)) {
                $names = array_filter(array_map(function ($v) {
                    return trim((string) $v);
                }, $raw), fn ($s) => $s !== '');
            } else {
                // support d'un champ texte séparé par virgules
                $names = array_filter(array_map('trim', preg_split('/[,;\n]+/', (string) $raw) ?: []), fn ($s) => $s !== '');
            }

            if (! empty($names)) {
                // crée/retourne les tags, puis sync sur le pivot
                $ids = [];
                foreach ($names as $name) {
                    $slug = str($name)->lower()->slug('-');
                    $tag = \App\Models\Tag::firstOrCreate(['slug' => $slug], ['name' => $name]);
                    $ids[] = $tag->id;
                }
                $product->tags()->sync($ids);
            } else {
                $product->tags()->sync([]);
            }
        }
    }

    private function authorizeImportDb(Request $request, ?int $dbProductsId): void
    {
        $user = $request->user();

        if (! $user) {
            abort(403, 'Unauthorized');
        }

        $canManageAll = $user->hasRole('admin')
            || $user->hasRole('dev')
            || $user->hasPermissionTo('users.db_products.manage.all');

        if ($canManageAll) {
            return;
        }

        if (! $user->hasPermissionTo('users.db_products.manage.his')) {
            abort(403, 'Unauthorized');
        }

        if (! $dbProductsId || $dbProductsId <= 0) {
            abort(403, 'Unauthorized');
        }

        $relation = $user->dbProducts()->where('db_products.id', $dbProductsId);

        if (Schema::hasColumn('db_product_user', 'can_sell')) {
            $relation->where('db_product_user.can_sell', true);
        }

        if (! $relation->exists()) {
            abort(403, 'Unauthorized');
        }
    }

    /**
     * Génère les propositions triées selon la logique de recherche.
     */
    public static function getSearchPropositions(Builder $query, ?string $search)
    {
        if (empty($search)) {
            return [];
        }

        $lowerSearch = mb_strtolower($search);

        $applyNameSearch = function ($q, string $search) {
            $normalized = trim($search);
            $tokens = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $isSingleNumeric = count($tokens) === 1 && ctype_digit($tokens[0]);

            $q->where(function ($qq) use ($tokens, $isSingleNumeric) {
                if ($isSingleNumeric) {
                    $qq->where('products.id', '=', (int) $tokens[0]);
                }

                $qq->orWhere(function ($qqq) use ($tokens) {
                    foreach ($tokens as $t) {
                        $qqq->where('products.name', 'like', '%'.$t.'%');
                    }
                });
            });
        };

        // Récupération des noms distincts - réinitialiser le ORDER BY pour éviter les conflits
        $clonedQuery = clone $query;
        $clonedQuery->getQuery()->orders = null; // Supprime les ORDER BY
        $applyNameSearch($clonedQuery, $search);

        $propositions = $clonedQuery
            ->selectRaw('MIN(id) as id, name, MIN(created_at) as created_at')
            ->groupBy('name')
            ->pluck('name');

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
        $cleaned = $propositions
            ->map(fn ($name) => $clean($name))
            ->filter(fn ($name) => ! empty($name))
            ->unique()
            ->values();

        if ($cleaned->isEmpty()) {
            $refQuery = clone $query;
            $refQuery->getQuery()->orders = null;

            $refSuggestions = $refQuery
                ->whereNotNull('ref')
                ->where('ref', '!=', '')
                ->where('ref', 'like', '%'.$search.'%')
                ->select(['ref', 'name', 'pot', 'height'])
                ->distinct()
                ->get()
                ->map(function ($row) {
                    $ref = trim((string) ($row->ref ?? ''));
                    $name = trim((string) ($row->name ?? ''));
                    $pot = trim((string) ($row->pot ?? ''));
                    $height = trim((string) ($row->height ?? ''));
                    if ($ref === '' || $name === '') {
                        return null;
                    }
                    $extras = [];
                    if ($pot !== '') {
                        $extras[] = 'pot '.$pot;
                    }
                    if ($height !== '') {
                        $extras[] = 'h '.$height;
                    }

                    $suffix = ! empty($extras) ? ' ('.implode(', ', $extras).')' : '';

                    return [
                        'value' => $ref,
                        'label' => $ref.' : '.$name.$suffix,
                    ];
                })
                ->filter(fn ($value) => ! empty($value))
                ->unique()
                ->values()
                ->all();

            usort($refSuggestions, function ($a, $b) use ($lowerSearch) {
                $aLabel = mb_strtolower((string) ($a['label'] ?? ''));
                $bLabel = mb_strtolower((string) ($b['label'] ?? ''));

                $pa = str_starts_with($aLabel, $lowerSearch) ? 1 : (str_contains($aLabel, $lowerSearch) ? 2 : 3);
                $pb = str_starts_with($bLabel, $lowerSearch) ? 1 : (str_contains($bLabel, $lowerSearch) ? 2 : 3);

                if ($pa !== $pb) {
                    return $pa <=> $pb;
                }

                $la = mb_strlen($aLabel);
                $lb = mb_strlen($bLabel);
                if ($la !== $lb) {
                    return $la <=> $lb;
                }

                return strnatcmp($aLabel, $bLabel);
            });

            return $refSuggestions;
        }

        // --- 🔢 Tri selon priorités ---
        $items = $cleaned->all();

        usort($items, function ($a, $b) use ($lowerSearch) {
            // Priorité :
            // 1 = mot unique (sans espace ni tiret) qui commence par le terme
            // 2 = commence par le terme
            // 3 = contient le terme ailleurs
            // 4 = autres
            $pa = (
                ! preg_match('/[-\s]/', $a) && str_starts_with($a, $lowerSearch)
            ) ? 1 : (
                str_starts_with($a, $lowerSearch) ? 2 : (
                    str_contains($a, $lowerSearch) ? 3 : 4
                ));

            $pb = (
                ! preg_match('/[-\s]/', $b) && str_starts_with($b, $lowerSearch)
            ) ? 1 : (
                str_starts_with($b, $lowerSearch) ? 2 : (
                    str_contains($b, $lowerSearch) ? 3 : 4
                ));

            if ($pa !== $pb) {
                return $pa <=> $pb;
            }

            // Second critère : longueur
            $la = mb_strlen($a);
            $lb = mb_strlen($b);
            if ($la !== $lb) {
                return $la <=> $lb;
            }

            // Troisième : ordre alphabétique
            return strnatcmp($a, $b);
        });

        // dd($items);
        // Prend les 7 premiers
        return $items;
    }

    private function updateImportState(string $id, array $payload): void
    {
        $existing = Cache::get("import:$id", []);
        $state = array_merge($existing, $payload);
        Cache::put("import:$id", $state, now()->addHour());
    }

    private function countValidLines(string $fullPath, callable $normalizeKey): int
    {
        $reader = Reader::from($fullPath, 'r');
        $reader->setDelimiter(';');
        $reader->setHeaderOffset(0);
        $headers = $reader->getHeader();

        $keyMap = [];
        foreach ($headers as $header) {
            $keyMap[$header] = $normalizeKey($header);
        }

        $total = 0;

        foreach ($reader->getRecords() as $row) {
            $mapped = $this->mapRow($row, $keyMap, $normalizeKey);
            if (! $this->rowHasContent($mapped)) {
                continue;
            }

            $sku = trim((string) ($mapped['sku'] ?? ''));
            if ($sku === '') {
                continue;
            }

            $total++;
        }

        return $total;
    }

    private function mapRow(array $row, array $keyMap, callable $normalizeKey): array
    {
        $mapped = [];
        foreach ($row as $key => $value) {
            $normalizedKey = $keyMap[$key] ?? $normalizeKey($key);
            if (is_string($value)) {
                $trimmed = trim($value);
                $mapped[$normalizedKey] = $trimmed === '' ? null : $trimmed;
            } else {
                $mapped[$normalizedKey] = $value;
            }
        }

        return $mapped;
    }

    private function rowHasContent(array $row): bool
    {
        foreach ($row as $value) {
            if ($value !== null && $value !== '') {
                return true;
            }
        }

        return false;
    }

    private function writeReportLine(mixed $handle, int $line, string $message, array $rawRow, array $mapped): void
    {
        if (! $handle) {
            return;
        }

        $rawValues = is_array($rawRow) ? implode('|', array_values($rawRow)) : '';

        fputcsv($handle, [
            $line,
            $message,
            $mapped['sku'] ?? null,
            $mapped['name'] ?? null,
            $rawValues,
        ], ';');
    }
}
