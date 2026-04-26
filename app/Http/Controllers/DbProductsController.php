<?php

namespace App\Http\Controllers;

use App\Models\CategoryProducts;
use App\Models\DbProducts;
use App\Http\Resources\DbProductsResource;
use App\Services\ProductImportPreAnalyzer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
        $search = $request->get('q');
        $query = DbProducts::query()->orderFromRequest($request);
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
    public function create()
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

        DbProducts::create($validated);

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
    public function edit(DbProducts $db_product)
    {
        return Inertia::render('products/db-edit', [
            'dbProduct' => DbProductsResource::make($db_product)->resolve(),
            'categoryOptions' => $this->categoryOptions(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, DbProducts $db_product)
    {
        $validated = $this->validatePayload($request, $db_product);

        $db_product->update($validated);

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
     */
    private function getSearchPropositions($query, ?string $search)
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
}
