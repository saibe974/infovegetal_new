<?php

namespace App\Http\Controllers;

use App\Http\Requests\FormProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Facades\Gate;

use App\Jobs\ImportProductsJob;


class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
    //    $product = Product::with('category')->find(1);
    //    dd($product->category->name);
    $query = Product::with(['category','tags'])->orderFromRequest($request);
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

        $uploaded = $request->file('file');

        // S'assure que le dossier existe puis tente de stocker le fichier
        Storage::makeDirectory('imports');
        $path = $uploaded->store('imports');

        // Récupère un chemin absolu fiable (compatible Windows) ou retombe sur le tmp si besoin
        $fullPath = Storage::exists($path) ? Storage::path($path) : $uploaded->getRealPath();
        if (!is_string($fullPath) || !is_file($fullPath)) {
            return redirect()->back()->with('error', "Impossible d'accéder au fichier importé");
        }


        // On lit le fichier CSV directement
        $handle = fopen($fullPath, 'r');
        $header = fgetcsv($handle, 0, ';'); // On lit l'en-tête (séparateur ';')
        // Retire un éventuel BOM sur la première clé
        if (is_array($header) && isset($header[0])) {
            $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
        }
        // Normalise les noms de colonnes: trim et lowercase
        if (is_array($header)) {
            $header = array_map(function ($h) {
                if ($h === null) return null;
                $h = (string) $h;
                $h = trim($h);
                $h = mb_strtolower($h);
                return $h;
            }, $header);
        }

        DB::beginTransaction();
        try {
            while (($data = fgetcsv($handle, 0, ';')) !== false) {
                // Aligne la longueur des données sur celle de l'entête
                if (!is_array($data)) $data = [];
                $hdrCount = is_array($header) ? count($header) : 0;
                if (count($data) < $hdrCount) {
                    $data = array_pad($data, $hdrCount, null);
                } elseif (count($data) > $hdrCount && $hdrCount > 0) {
                    $data = array_slice($data, 0, $hdrCount);
                }

                $row = $hdrCount > 0 ? array_combine($header, $data) : [];
                if (!is_array($row)) $row = [];

                // Trim values and treat whitespace-only as empty
                foreach ($row as $k => $v) {
                    if (is_string($v)) {
                        $v = trim($v);
                        $row[$k] = $v === '' ? null : $v;
                    } else {
                        $row[$k] = $v;
                    }
                }

                // Skip empty rows (after trimming)
                $hasValue = false;
                foreach ($row as $v) {
                    if ($v !== null && $v !== '') { $hasValue = true; break; }
                }
                if (!$hasValue) continue;

                $sku = trim((string)($row['sku'] ?? ''));
                if ($sku === '') continue; // ignore rows without SKU

                Product::updateOrCreate(
                    ['sku' => $sku], // Clé unique pour trouver le produit
                    [
                        'name' => trim((string)($row['name'] ?? '')),
                        'img_link' => isset($row['img_link']) ? trim((string)$row['img_link']) : null,
                        'description' => isset($row['description']) ? trim((string)$row['description']) : null,
                        'price' => isset($row['price']) ? $row['price'] : 0,
                        'active' => isset($row['active']) ? (bool)$row['active'] : true,
                        // Ajoutez d'autres champs selon votre structure
                    ]
                );
            }
            DB::commit();

            // Nettoyage
            fclose($handle);

            // Conserver un historique en local, nettoyer en prod
            try {
                if (app()->isLocal()) {
                    // s'assure que le dossier d'archive existe puis déplace le fichier
                    Storage::makeDirectory('imports/archive');
                    if (Storage::exists($path)) {
                        Storage::move($path, 'imports/archive/' . basename($path));
                    }
                } else {
                    if (Storage::exists($path)) {
                        Storage::delete($path);
                    }
                }
            } catch (\Throwable $t) {
                // En cas d'échec d'archivage/suppression, on ignore pour ne pas bloquer
                Log::warning('Import cleanup error: ' . $t->getMessage());
            }

            return redirect()->back()->with('success', 'Import terminé avec succès');
        } catch (\Exception $e) {
            DB::rollBack();
            fclose($handle);
            Storage::delete($path);
            return redirect()->back()->with('error', 'Erreur lors de l\'import : ' . $e->getMessage());
        }
    }

    /**
     * Upload-only endpoint: stocke le fichier CSV et renvoie un id d'import.
     */
    public function importUpload(Request $request)
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $file = $request->file('file');
        Storage::makeDirectory('imports');
        $filename = now()->format('Ymd_His') . '_' . Str::random(8) . '.csv';
        $path = $file->storeAs('imports', $filename);

        $id = (string) Str::uuid();
        Cache::put("import:$id", [
            'status' => 'uploaded',
            'progress' => 0,
            'path' => $path,
            'total' => null,
            'processed' => 0,
            'errors' => 0,
        ], now()->addHour());

        return response()->json([
            'id' => $id,
            'path' => $path,
            'original' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
        ]);
    }

    /**
     * Traite le fichier CSV précédemment uploadé (calcul progress côté cache).
     */

    public function importProcess(Request $request)
    {
        $data = $request->validate(['id' => 'required|string']);
        $id = $data['id'];

        $state = Cache::get("import:$id");
        if (!$state || empty($state['path'])) {
            return response()->json(['message' => 'Import inconnu'], 404);
        }

        // Lancer le job en file d’attente avec un chemin ABSOLU (important pour le worker)
        $absolutePath = Storage::path($state['path']);
        ImportProductsJob::dispatch($id, $absolutePath);

        Cache::put("import:$id", [
            'status' => 'queued',
            'progress' => 0,
            'processed' => 0,
            'total' => 0,
            'errors' => 0,
        ], now()->addHour());

        return response()->json(['status' => 'queued']);
    }


    /**
     * Renvoie la progression (upload/processing/done) pour l'id d'import.
     */
    public function importProgress(string $id)
    {
        $progress = Cache::get("import:$id");

        if (!$progress) {
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
        ]);
    }

    /**
     * Télécharge le rapport d'erreurs CSV pour un import donné.
     */
    public function importReport(string $id)
    {
        $reportPath = 'imports/reports/' . $id . '.csv';
        if (!Storage::exists($reportPath)) {
            return response()->json(['message' => 'Rapport introuvable'], 404);
        }

        $full = Storage::path($reportPath);
        $filename = 'import_report_' . $id . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($full) {
            $h = fopen($full, 'r');
            while (!feof($h)) {
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
        Cache::put("import:$id:cancel", true, now()->addHour());
        $state = Cache::get("import:$id", []);
        Cache::put("import:$id", array_merge($state, [ 'status' => 'cancelling' ]), now()->addHour());
        return response()->json(['status' => 'cancelling']);
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
            // header (séparateur ';')
            fputcsv($handle, ['id', 'sku', 'name', 'category', 'description', 'price', 'active'], ';');

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
                    ], ';');
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
        // Synchronisation des tags si fournis
        $raw = $request->input('tags');
        if ($raw !== null) {
            $names = [];
            if (is_array($raw)) {
                $names = array_filter(array_map(function ($v) {
                    return trim((string)$v);
                }, $raw), fn($s) => $s !== '');
            } else {
                // support d'un champ texte séparé par virgules
                $names = array_filter(array_map('trim', preg_split('/[,;\n]+/', (string)$raw) ?: []), fn($s) => $s !== '');
            }

            if (!empty($names)) {
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
