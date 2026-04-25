<?php

namespace App\Http\Controllers;

use App\Models\CategoryProducts;
use App\Models\DbProducts;
use App\Http\Resources\DbProductsResource;
use Illuminate\Http\Request;
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
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
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
            'categoryOptions' => CategoryProducts::query()
                ->select(['id', 'name'])
                ->orderBy('name')
                ->get()
                ->map(fn (CategoryProducts $category) => [
                    'id' => (int) $category->id,
                    'name' => (string) $category->name,
                ])
                ->values()
                ->all(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, DbProducts $db_product)
    {
        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:255', \Illuminate\Validation\Rule::unique('db_products', 'name')->ignore($db_product->id)],
            'description' => ['nullable', 'string', 'max:500'],
            'champs'      => ['nullable', 'array'],
            'champs.*'    => ['nullable', 'string'],
            'categories'  => ['nullable', 'array'],
            'categories.*'=> ['nullable', 'string'],
            'country'     => ['nullable', 'string', 'size:2'],
            'mod_liv'     => ['nullable', 'string', 'max:100'],
            'mini'        => ['nullable', 'integer', 'min:0'],
        ]);

        $db_product->update($validated);

        return redirect()->route('db-products.index')->with('success', __('Database updated.'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(DbProducts $db_product)
    {
        //
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
}
