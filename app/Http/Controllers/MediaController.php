<?php

namespace App\Http\Controllers;

use App\Models\CategoryProducts;
use App\Models\DbProducts;
use App\Models\Product;
use App\Services\ProductMediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class MediaController extends Controller
{
    public function index(Request $request)
    {
        return Inertia::render('media/index');
    }

    public function images(Request $request)
    {
        return Inertia::render('media/missing-images', [
            'dbProducts' => DbProducts::query()->orderBy('name')->get(['id', 'name']),
            'categories' => CategoryProducts::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function imageItems(Request $request, ProductMediaService $mediaService): JsonResponse
    {
        $data = $request->validate([
            'after' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'q' => ['nullable', 'string', 'max:150'],
            'db_products_id' => ['nullable', 'integer', 'min:1'],
            'category_products_id' => ['nullable', 'integer', 'min:1'],
            'with_total' => ['nullable', 'boolean'],
        ]);

        $after = (int) ($data['after'] ?? 0);
        $limit = (int) ($data['limit'] ?? 48);
        $search = trim((string) ($data['q'] ?? ''));
        $dbProductsId = isset($data['db_products_id']) ? (int) $data['db_products_id'] : null;
        $categoryProductsId = isset($data['category_products_id']) ? (int) $data['category_products_id'] : null;

        $baseQuery = $this->imageCandidatesQuery($dbProductsId, $categoryProductsId);
        if ($search !== '') {
            $baseQuery->where(function ($query) use ($search) {
                $query->where('name', 'like', '%'.$search.'%')
                    ->orWhere('sku', 'like', '%'.$search.'%')
                    ->orWhere('ref', 'like', '%'.$search.'%');
            });
        }

        $scan = $this->scanMissingImages(clone $baseQuery, $after, $limit, $mediaService);
        $total = $request->boolean('with_total')
            ? $this->countMissingImages(clone $baseQuery, $mediaService)
            : null;

        return response()->json([
            'items' => $scan['items']->map(function (array $item) {
                /** @var Product $product */
                $product = $item['product'];

                return [
                    'id' => (int) $product->id,
                    'sku' => $product->sku,
                    'ref' => $product->ref,
                    'name' => $product->name,
                    'source_url' => $product->getRawOriginal('img_link'),
                    'db_name' => $product->dbProduct?->name,
                    'category_name' => $product->category?->name,
                    'local_url' => null,
                    'thumb_url' => null,
                    'missing_reason' => $item['status']['reason'],
                ];
            })->values(),
            'next_cursor' => $scan['cursor'],
            'has_more' => $scan['has_more'],
            'total' => $total,
        ]);
    }

    public function actionDownload(Request $request, ProductMediaService $mediaService): JsonResponse
    {
        $product = $this->findProductForAction($request);
        if (! $product) {
            return response()->json(['ok' => false, 'message' => 'Produit introuvable'], 404);
        }

        $result = $mediaService->downloadMissing($product);
        $product->loadMissing(['dbProduct:id,name', 'category:id,name']);

        return response()->json(array_merge($result, [
            'product' => $this->imageProductPayload($product, $mediaService),
        ]));
    }

    public function actionCompare(Request $request, ProductMediaService $mediaService): JsonResponse
    {
        $product = $this->findProductForAction($request);
        if (! $product) {
            return response()->json(['ok' => false, 'message' => 'Produit introuvable'], 404);
        }

        try {
            return response()->json($mediaService->compareRemoteWithLocal($product));
        } catch (\Throwable $e) {
            Log::warning('Media compare failed', ['product_id' => $product->id, 'error' => $e->getMessage()]);

            return response()->json(['ok' => false, 'message' => 'Comparaison impossible'], 500);
        }
    }

    public function actionThumbnail(Request $request, ProductMediaService $mediaService): JsonResponse
    {
        $product = $this->findProductForAction($request);
        if (! $product) {
            return response()->json(['ok' => false, 'message' => 'Produit introuvable'], 404);
        }

        return response()->json($mediaService->ensureThumbnail($product));
    }

    public function actionRemoveMissingImgLink(Request $request, ProductMediaService $mediaService): JsonResponse
    {
        $product = $this->findProductForAction($request);
        if (! $product) {
            return response()->json(['ok' => false, 'message' => 'Produit introuvable'], 404);
        }

        return response()->json(
            $mediaService->removeImgLinkIfMissing($product, $request->boolean('force'))
        );
    }

    private function imageCandidatesQuery(?int $dbProductsId, ?int $categoryProductsId)
    {
        $query = Product::query()
            ->where('active', true)
            ->whereNotNull('img_link')
            ->where('img_link', '!=', '')
            ->orderBy('id');

        if ($dbProductsId) {
            $query->where('db_products_id', $dbProductsId);
        }

        if ($categoryProductsId) {
            $query->where('category_products_id', $categoryProductsId);
        }

        return $query;
    }

    private function imageProductPayload(Product $product, ProductMediaService $mediaService): array
    {
        $status = $mediaService->localImageStatus($product);

        return [
            'id' => (int) $product->id,
            'sku' => $product->sku,
            'ref' => $product->ref,
            'name' => $product->name,
            'source_url' => $product->getRawOriginal('img_link'),
            'db_name' => $product->dbProduct?->name,
            'category_name' => $product->category?->name,
            'local_url' => $status['original_exists'] ? $product->getFirstMediaUrl('images') : null,
            'thumb_url' => $status['original_exists'] ? $product->getFirstMediaUrl('images', 'thumb') : null,
            'missing_reason' => $status['reason'],
        ];
    }

    private function scanMissingImages($query, int $after, int $limit, ProductMediaService $mediaService): array
    {
        $items = collect();
        $cursor = $after;
        $remainingScan = 2000;

        while ($items->count() < $limit && $remainingScan > 0) {
            $chunkSize = min(200, $remainingScan);
            $products = (clone $query)
                ->with([
                    'dbProduct:id,name',
                    'category:id,name',
                    'media' => fn ($mediaQuery) => $mediaQuery->where('collection_name', 'images'),
                ])
                ->where('products.id', '>', $cursor)
                ->reorder()
                ->orderBy('products.id')
                ->limit($chunkSize)
                ->get();

            if ($products->isEmpty()) {
                break;
            }

            foreach ($products as $product) {
                $cursor = (int) $product->id;
                $remainingScan--;
                $status = $mediaService->localImageStatus($product);

                if (! $status['original_exists']) {
                    $items->push(['product' => $product, 'status' => $status]);
                }

                if ($items->count() >= $limit || $remainingScan <= 0) {
                    break;
                }
            }

            if ($products->count() < $chunkSize) {
                break;
            }
        }

        $hasMore = (clone $query)
            ->where('products.id', '>', $cursor)
            ->exists();

        return [
            'items' => $items,
            'cursor' => $cursor,
            'has_more' => $hasMore,
        ];
    }

    private function countMissingImages($query, ProductMediaService $mediaService): int
    {
        $count = 0;

        $query
            ->with(['media' => fn ($mediaQuery) => $mediaQuery->where('collection_name', 'images')])
            ->reorder()
            ->chunkById(200, function ($products) use (&$count, $mediaService) {
                foreach ($products as $product) {
                    if (! $mediaService->localImageStatus($product)['original_exists']) {
                        $count++;
                    }
                }
            });

        return $count;
    }

    private function findProductForAction(Request $request): ?Product
    {
        $data = $request->validate([
            'id' => ['required', 'integer', 'min:1'],
        ]);

        return Product::query()->find((int) $data['id']);
    }
}
