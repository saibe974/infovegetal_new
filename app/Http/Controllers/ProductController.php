<?php

namespace App\Http\Controllers;

use App\Http\Requests\FormProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Facades\Gate;

class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
    //    $product = Product::with('category')->find(1);
    //    dd($product->category->name);
        $query = Product::with('category')->orderFromRequest($request);
        $search = $request->get('q');

        if ($search) {
            $normalized = trim($search);
            $tokens = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $isSingleNumeric = count($tokens) === 1 && ctype_digit($tokens[0]);

            $query->where(function ($q) use ($tokens, $isSingleNumeric) {
                // Si un seul terme numérique, tenter l'ID exact
                if ($isSingleNumeric) {
                    $q->where('id', '=', (int) $tokens[0]);
                }

                // Et toujours proposer une recherche sur le nom qui contient tous les termes
                $q->orWhere(function ($qq) use ($tokens) {
                    foreach ($tokens as $t) {
                        $qq->where('name', 'like', '%' . $t . '%');
                    }
                });
            });
        }

       return Inertia::render('products/index', [
            'q' => $search,
            'collection' => Inertia::scroll(fn() => ProductResource::collection(
                $query->paginate(10)
            )),
            'searchPropositions' => Inertia::optional(fn() => $this->getSearchPropositions($query, $search)),
        ]);

    }


    /**
     * Handle CSV upload import. Expects a multipart file named 'file'.
     */
    public function import(Request $request)
    {
        // Validation stricte du fichier CSV
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        if (!$request->hasFile('file')) {
            return redirect()->back()->with('error', "Aucun fichier reçu");
        }

        $path = $request->file('file')->store('imports');
        $fullPath = storage_path('app/' . $path);
        

        // On lit le fichier CSV directement
        $handle = fopen($fullPath, 'r');
        $header = fgetcsv($handle); // On lit l'en-tête

        DB::beginTransaction();
        try {
            while (($data = fgetcsv($handle)) !== false) {
                $row = array_combine($header, $data);
                Product::updateOrCreate(
                    ['sku' => $row['sku']], // Clé unique pour trouver le produit
                    [
                        'name' => $row['name'],
                        'description' => $row['description'] ?? null,
                        'price' => $row['price'] ?? 0,
                        'active' => $row['active'] ?? true,
                        // Ajoutez d'autres champs selon votre structure
                    ]
                );
            }
            DB::commit();
            
            // Nettoyage
            fclose($handle);
            Storage::delete($path);
            
            return redirect()->back()->with('success', 'Import terminé avec succès');
        } catch (\Exception $e) {
            DB::rollBack();
            fclose($handle);
            Storage::delete($path);
            return redirect()->back()->with('error', 'Erreur lors de l\'import : ' . $e->getMessage());
        }
    }

    /**
     * Export products as CSV.
     */
    public function export(Request $request)
    {
    Gate::authorize('manage-products');

        $filename = 'products_export_' . date('Ymd_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () {
            $handle = fopen('php://output', 'w');
            // header
            fputcsv($handle, ['id', 'sku', 'name', 'category', 'description', 'price', 'active']);

            Product::with('category')->chunk(100, function ($products) use ($handle) {
                foreach ($products as $p) {
                    fputcsv($handle, [
                        $p->id,
                        $p->sku,
                        $p->name,
                        $p->category?->name,
                        $p->description,
                        $p->price,
                        $p->active ? 1 : 0,
                    ]);
                }
            });

            fclose($handle);
        };

        return new StreamedResponse($callback, 200, $headers);
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
        $product = Product::create($request->validated());
        $this->handleFormRequest($product, $request);

        return redirect()->route('products.edit', $product)->with('success', 'Produit créé');
    }

    /**
     * Display the specified resource.
     */
    public function show(Product $product)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Product $product)
    {
        return Inertia::render('products/form', [
            'product' => new ProductResource($product),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(FormProductRequest $request, Product $product)
    {
        $product->update($request->validated());
        $this->handleFormRequest($product, $request);
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
        // $image = $request->validated('image');
        // if ($image && $image instanceof UploadedFile) {
        //     $product->addMedia($image)->toMediaCollection('image');
        // }
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
        $propositions = (clone $query)
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
        $cleaned = $propositions
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
