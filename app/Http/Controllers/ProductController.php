<?php

namespace App\Http\Controllers;

use App\Http\Requests\FormProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\ProductImportService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Facades\Gate;
use League\Csv\Reader;


class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
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
                $query->paginate(12)
            )),
            'searchPropositions' => Inertia::optional(fn() => $this->getSearchPropositions($query, $search)),
        ]);

    }

    /**
     * Traite le fichier CSV précédemment uploadé (calcul progress côté cache).
     */

    public function importProcess(Request $request, ProductImportService $importService)
    {
        $data = $request->validate(['id' => 'required|string']);
        $id = $data['id'];
        $dbProductsId = $request->integer('db_products_id'); // optionnel

        $state = Cache::get("import:$id", []);
        
        if (!$state || empty($state['path'])) {
            return response()->json(['message' => 'Import inconnu'], 404);
        }

        $path = $state['path'];
        $fullPath = Storage::path($path);

        if (!is_string($fullPath) || !is_file($fullPath)) {
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

        Log::info("Import started synchronously for ID: $id with db_products_id: $dbProductsId");

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
        if (!$state || empty($state['path'])) {
            return response()->json(['message' => 'Import inconnu'], 404);
        }

        $path = $state['path'];
        $fullPath = Storage::path($path);

        if (!is_string($fullPath) || !is_file($fullPath)) {
            return response()->json(['message' => "Impossible d'accéder au fichier importé"], 400);
        }

        $relativePath = $path;
        $chunkIndex = isset($state['next_offset']) ? (int) $state['next_offset'] : 0;

        Log::info("Import chunk requested for ID: $id at chunk index $chunkIndex");

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
            'next_offset' => $progress['next_offset'] ?? null,
            'has_more' => $progress['has_more'] ?? false,
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
            fputcsv($handle, ['sku', 'name', 'img_link', 'category', 'description', 'price', 'active'], ';');

            Product::with('category')->chunk(100, function ($products) use ($handle) {
                foreach ($products as $p) {
                    fputcsv($handle, [
                        $p->sku,
                        $p->name,
                        $p->img_link,
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
    public static function getSearchPropositions($query, ?string $search)
    {
        if (empty($search)) {
            return [];
        }
        
        $lowerSearch = mb_strtolower($search);

        // Récupération des noms distincts - réinitialiser le ORDER BY pour éviter les conflits
        $clonedQuery = clone $query;
        $clonedQuery->getQuery()->orders = null; // Supprime les ORDER BY
        
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
            if (!$this->rowHasContent($mapped)) {
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

    private function writeReportLine($handle, int $line, string $message, array $rawRow, array $mapped): void
    {
        if (!$handle) {
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
