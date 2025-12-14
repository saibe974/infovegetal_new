<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Resources\CategoryProductsResource;
use App\Models\CategoryProducts;
use Inertia\Inertia;

class CategoryProductsController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $search = $request->get('q');
        $query = CategoryProducts::query()->orderFromRequest($request);
        if ($search) {
            $query->where('name', 'like', '%' . $search . '%');
        }

        // Si pas de recherche, on récupère les catégories racines avec pagination
        if (!$search) {
            $query->whereNull('parent_id')->defaultOrder();
            
            return Inertia::render('products/categories-index', [
                'q' => $search,
                'collection' => Inertia::scroll(fn() => CategoryProductsResource::collection(
                    $query->paginate(20)
                )),
                // Compte total de toutes les catégories (racines + sous-catégories)
                'totalCount' => CategoryProducts::query()->count(),
                'children' => Inertia::optional(fn() => $this->getChildrenForExpanded($request)),
                'searchPropositions' => null,
            ]);
        }

        return Inertia::render('products/categories-index', [
            'q' => $search,
            'collection' => Inertia::scroll(fn() => CategoryProductsResource::collection(
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
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }

    /**
     * Reorder categories with nested set structure.
     */
    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|exists:category_products,id',
            'items.*.parent_id' => 'nullable|exists:category_products,id',
        ]);

        try {
            DB::beginTransaction();

            // Séparer les racines et les enfants
            $roots = [];
            $children = [];

            foreach ($validated['items'] as $item) {
                if ($item['parent_id'] === null) {
                    $roots[] = $item;
                } else {
                    $children[] = $item;
                }
            }

            // D'abord, traiter les racines
            foreach ($roots as $item) {
                $category = CategoryProducts::find($item['id']);
                $category->saveAsRoot();
            }

            // Ensuite, traiter les enfants
            foreach ($children as $item) {
                $category = CategoryProducts::find($item['id']);
                $parent = CategoryProducts::find($item['parent_id']);
                if ($parent) {
                    $category->appendToNode($parent)->save();
                }
            }

            // Reconstruire l'arbre pour garantir la cohérence
            CategoryProducts::fixTree();

            DB::commit();

            return response()->json(['message' => 'Hierarchy updated successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update hierarchy', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Récupère les enfants d'une catégorie.
     */
    public function children(Request $request)
    {
        $parentId = $request->get('parent_id');
        $perPage = (int) ($request->get('per_page') ?? 12);
        $page = (int) ($request->get('page') ?? 1);
        
        if (!$parentId) {
            return response()->json([]);
        }

        $query = CategoryProducts::where('parent_id', $parentId)
            ->defaultOrder();

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $data = CategoryProductsResource::collection($paginator->items())->resolve();

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * Récupère les enfants des catégories expandées.
     */
    private function getChildrenForExpanded(Request $request)
    {
        $expandedIds = $request->get('expanded', []);
        
        if (empty($expandedIds)) {
            return [];
        }

        // Récupérer les enfants directs des catégories expandées
        $children = CategoryProducts::whereIn('parent_id', $expandedIds)
            ->defaultOrder()
            ->get();

        return CategoryProductsResource::collection($children);
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
