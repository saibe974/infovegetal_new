<?php

namespace App\Http\Controllers;

use App\Http\Requests\BulkUpdateProductsRequest;
use App\Models\CategoryProducts;
use App\Models\Producer;
use App\Models\Product;
use App\Models\Tag;
use App\Services\ProductCatalogQuery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class BulkProductController extends Controller
{
    public function edit(Request $request)
    {
        $catalog = new ProductCatalogQuery($request);
        $ids = $catalog->query()->reorder()->pluck('products.id')->all();
        $selection = (string) Str::uuid();
        $filters = $request->only(['q', 'active', 'category', 'country', 'pot', 'height', 'producer', 'image', 'promo', 'cart', 'sort', 'dir']);
        $returnUrl = route('products.index', $filters);

        // Freeze the complete result set so editing a filtered field cannot skip products.
        Cache::put('products:bulk:'.$selection, [
            'user_id' => $request->user()->id,
            'ids' => $ids,
            'return_url' => $returnUrl,
        ], now()->addHour());

        return Inertia::render('products/bulk-edit', [
            'selection' => $selection,
            'total' => count($ids),
            'returnUrl' => $returnUrl,
            'filterSummary' => $this->filterSummary($request, $catalog),
            'categories' => CategoryProducts::query()->defaultOrder()->get(['id', 'name', 'parent_id']),
            'tagOptions' => Tag::query()->orderBy('name')->pluck('name'),
        ]);
    }

    private function filterSummary(Request $request, ProductCatalogQuery $catalog): array
    {
        $summary = [];
        $add = function (string $label, string $value) use (&$summary) {
            $summary[] = ['label' => $label, 'value' => $value];
        };
        if ($catalog->search !== null && $catalog->search !== '') {
            $add('Recherche', $catalog->search);
        }
        if ($catalog->activeFilter !== null) {
            $add('Statut', $catalog->activeFilter ? 'Actifs' : 'Inactifs');
        }
        $filters = $catalog->filters;
        if ($filters['category']) {
            $add('Catégorie', CategoryProducts::find($filters['category'])?->name ?? (string) $filters['category']);
        }
        foreach (['country' => 'Pays', 'pot' => 'Pot', 'height' => 'Hauteur'] as $key => $label) {
            if ($filters[$key] !== []) {
                $add($label, implode(', ', $filters[$key]));
            }
        }
        if ($filters['producer'] !== []) {
            $names = Producer::whereIn('id', array_filter($filters['producer'], 'is_numeric'))->pluck('name', 'id');
            $add('Producteur', implode(', ', array_map(fn ($value) => $names[$value] ?? $value, $filters['producer'])));
        }
        if ($filters['image'] !== null) {
            $add('Image', $filters['image'] === 'with' ? 'Avec image' : 'Sans image');
        }
        if ($filters['promo'] !== null) {
            $add('Promotion', $filters['promo'] ? 'En promotion' : 'Hors promotion');
        }
        if ($request->get('cart') === '1') {
            $add('Panier', 'Produits du panier');
        }

        return $summary;
    }

    public function update(BulkUpdateProductsRequest $request)
    {
        $data = $request->validated();
        $key = 'products:bulk:'.$data['selection'];
        $selection = Cache::get($key);
        if (! $selection || $selection['user_id'] !== $request->user()->id) {
            throw ValidationException::withMessages(['selection' => 'Cette sélection a expiré. Revenez à la liste pour recommencer.']);
        }
        if (empty($selection['ids'])) {
            throw ValidationException::withMessages(['selection' => 'Aucun produit à modifier.']);
        }

        $count = DB::transaction(function () use ($selection, $data) {
            $tagIds = [];
            if ($data['tags_mode'] !== 'keep') {
                foreach ($data['tags'] as $name) {
                    $slug = (string) str(trim($name))->lower()->slug('-');
                    $tag = $data['tags_mode'] === 'add'
                        ? Tag::firstOrCreate(['slug' => $slug], ['name' => trim($name)])
                        : Tag::where('slug', $slug)->first();
                    if ($tag) {
                        $tagIds[] = $tag->id;
                    }
                }
                $tagIds = array_unique($tagIds);
            }

            $count = 0;
            foreach (array_chunk($selection['ids'], 500) as $ids) {
                foreach (Product::whereIn('id', $ids)->lockForUpdate()->get() as $product) {
                    $product->fill($data['changes']);
                    if ((array_key_exists('available_from', $data['changes']) || array_key_exists('available_until', $data['changes']))
                        && $product->available_from && $product->available_until
                        && $product->available_until->lessThanOrEqualTo($product->available_from)) {
                        throw ValidationException::withMessages([
                            'changes.available_until' => "La fin de disponibilité doit suivre le début pour le produit #{$product->id}.",
                        ]);
                    }
                    $product->save();
                    if ($data['tags_mode'] === 'add') {
                        $product->tags()->syncWithoutDetaching($tagIds);
                    } elseif ($data['tags_mode'] === 'remove') {
                        $product->tags()->detach($tagIds);
                    }
                    $count++;
                }
            }

            return $count;
        });

        Cache::forget($key);

        return redirect($selection['return_url'])->with('success', "{$count} produit(s) mis à jour.");
    }
}
