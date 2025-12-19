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
            
            $roots = $query->paginate(20);
            $rootIds = $roots->pluck('id')->toArray();
            
            // Charger les enfants directs des racines
            $allChildren = CategoryProducts::whereIn('parent_id', $rootIds)
                ->defaultOrder()
                ->get();
            
            return Inertia::render('products/categories-index', [
                'q' => $search,
                'collection' => Inertia::scroll(fn() => CategoryProductsResource::collection($roots)),
                'totalCount' => CategoryProducts::query()->count(),
                'children' => CategoryProductsResource::collection($allChildren),
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
     * Déplace une catégorie par rapport à un parent/sibling (move granulaire).
     * Payload attendu:
     * { id: number, parent_id: number|null, before_id?: number|null, after_id?: number|null }
     */
    public function move(Request $request)
    {
        $data = $request->validate([
            'id' => 'required|exists:category_products,id',
            'parent_id' => 'nullable|exists:category_products,id',
            'before_id' => 'nullable|different:after_id|exists:category_products,id',
            'after_id' => 'nullable|different:before_id|exists:category_products,id',
        ]);

        if (!empty($data['before_id']) && !empty($data['after_id'])) {
            return response()->json(['message' => 'Specify either before_id or after_id, not both'], 422);
        }

        $category = CategoryProducts::findOrFail($data['id']);
        $targetParentId = $data['parent_id'] ?? null;
        $beforeId = $data['before_id'] ?? null;
        $afterId = $data['after_id'] ?? null;

        // Interdire de se déplacer sous un de ses propres descendants ou sous soi-même
        if ($targetParentId !== null) {
            if ((int)$targetParentId === (int)$category->getKey()) {
                return response()->json(['message' => 'Cannot move under itself'], 422);
            }
            $parent = CategoryProducts::findOrFail($targetParentId);
            if ($parent->isDescendantOf($category)) {
                return response()->json(['message' => 'Cannot move under a descendant'], 422);
            }
        }

        try {
            DB::beginTransaction();

            if ($targetParentId === null) {
                // Déplacement au niveau racine
                if ($beforeId) {
                    $sibling = CategoryProducts::findOrFail($beforeId);
                    if ($sibling->parent_id !== null) {
                        return response()->json(['message' => 'before_id must be a root sibling'], 422);
                    }
                    if ($sibling->isDescendantOf($category)) {
                        return response()->json(['message' => 'Cannot position relative to a descendant'], 422);
                    }
                    $category->beforeNode($sibling)->save();
                } elseif ($afterId) {
                    $sibling = CategoryProducts::findOrFail($afterId);
                    if ($sibling->parent_id !== null) {
                        return response()->json(['message' => 'after_id must be a root sibling'], 422);
                    }
                    if ($sibling->isDescendantOf($category)) {
                        return response()->json(['message' => 'Cannot position relative to a descendant'], 422);
                    }
                    $category->afterNode($sibling)->save();
                } else {
                    $category->saveAsRoot();
                }
            } else {
                // Déplacement sous un parent donné
                $parent = CategoryProducts::findOrFail($targetParentId);

                if ($beforeId) {
                    $sibling = CategoryProducts::findOrFail($beforeId);
                    if ((int)$sibling->parent_id !== (int)$parent->getKey()) {
                        return response()->json(['message' => 'before_id must be a child of parent_id'], 422);
                    }
                    if ($sibling->isDescendantOf($category)) {
                        return response()->json(['message' => 'Cannot position relative to a descendant'], 422);
                    }
                    $category->beforeNode($sibling)->save();
                } elseif ($afterId) {
                    $sibling = CategoryProducts::findOrFail($afterId);
                    if ((int)$sibling->parent_id !== (int)$parent->getKey()) {
                        return response()->json(['message' => 'after_id must be a child of parent_id'], 422);
                    }
                    if ($sibling->isDescendantOf($category)) {
                        return response()->json(['message' => 'Cannot position relative to a descendant'], 422);
                    }
                    $category->afterNode($sibling)->save();
                } else {
                    $category->appendToNode($parent)->save();
                }
            }

            DB::commit();
            return response()->json(['message' => 'Category moved']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Move failed', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Reorder categories with nested set structure.
     */
    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required','array'],
            'items.*.id' => ['required','integer','exists:category_products,id'],
            'items.*.parent_id' => ['nullable','integer','exists:category_products,id'],
            'items.*.position' => ['required','integer','min:0'],
        ]);

        return DB::transaction(function () use ($validated) {
            $rows = collect($validated['items']);

            // Sécurité anti-cycles simple : parent_id != id
            foreach ($rows as $r) {
                if (!is_null($r['parent_id']) && (int)$r['parent_id'] === (int)$r['id']) {
                    abort(422, 'Invalid parent.');
                }
            }

            // Vérifier qu'on n'a pas d'imbrication circulaire
            $rows->each(function ($r) use ($rows) {
                $parentId = $r['parent_id'];
                $visitedIds = new \SplFixedArray(1000);
                $visitedCount = 0;
                
                while ($parentId !== null) {
                    if ($visitedCount > 0 && in_array($parentId, array_slice((array)$visitedIds, 0, $visitedCount))) {
                        abort(422, 'Circular parent reference detected.');
                    }
                    $visitedIds[$visitedCount++] = $parentId;
                    
                    $parent = $rows->firstWhere('id', $parentId);
                    $parentId = $parent ? $parent['parent_id'] : null;
                    
                    if ($visitedCount > 100) break;
                }
            });

            $groups = $rows->groupBy(fn($r) => $r['parent_id'] ?? null);

            // Approach: delete all nodes and rebuild the tree from scratch
            // This avoids any nested set corruption
            $allIds = $rows->pluck('id')->toArray();
            $allNodes = \App\Models\CategoryProducts::whereIn('id', $allIds)->get();
            
            // Detach all nodes from the tree first
            foreach ($allNodes as $node) {
                $node->parent_id = null;
                $node->save();
            }
            
            // Now rebuild the tree
            $placeChildren = function ($parentId) use (&$placeChildren, $groups) {
                $children = ($groups->get($parentId, collect()))->sortBy('position')->values();
                $prev = null;

                foreach ($children as $r) {
                    $node = \App\Models\CategoryProducts::findOrFail($r['id']);
                    $node->refresh();

                    if ($parentId === null) {
                        $node->saveAsRoot();
                    } else {
                        $parent = \App\Models\CategoryProducts::findOrFail($parentId);
                        $parent->refresh();
                        $node->appendToNode($parent)->save();
                    }

                    if ($prev) {
                        $prev->refresh();
                        $node->afterNode($prev)->save();
                    }

                    $prev = $node;

                    // recurse
                    $placeChildren($node->id);
                }
            };

            // Démarrer par les racines
            $placeChildren(null);

            return response()->json(['ok' => true]);
        });
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
