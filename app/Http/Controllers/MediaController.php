<?php

namespace App\Http\Controllers;

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

    public function syncMissingImages(Request $request, ProductMediaService $mediaService): JsonResponse
    {
        $limit = (int) $request->input('limit', 200);
        $dbProductsId = $this->toNullableInt($request->input('db_products_id'));
        $categoryProductsId = $this->toNullableInt($request->input('category_products_id'));
        if ($limit < 1) {
            $limit = 1;
        }
        if ($limit > 500) {
            $limit = 500;
        }

        $baseQuery = $this->missingImagesQuery($dbProductsId, $categoryProductsId);

        $totalMissing = (int) $baseQuery->count();
        $products = $baseQuery->limit($limit)->get();

        $processed = 0;
        $downloaded = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($products as $product) {
            $processed++;
            $imgLink = $product->getRawOriginal('img_link');

            if (!$this->isRemoteUrl($imgLink)) {
                $skipped++;
                continue;
            }

            $synced = $mediaService->syncFromImgLink($product, $imgLink);
            if ($synced) {
                $downloaded++;
            } else {
                $failed++;
            }
        }


        $remainingMissing = (int) $this->missingImagesQuery($dbProductsId, $categoryProductsId)->count();

        return response()->json([
            'processed' => $processed,
            'downloaded' => $downloaded,
            'skipped' => $skipped,
            'failed' => $failed,
            'total_missing' => $totalMissing,
            'remaining_missing' => $remainingMissing,
            'limit' => $limit,
        ]);
    }

    public function images(Request $request)
    {
        return Inertia::render('media/missing-images');
    }

    public function imagesFrame(Request $request)
    {
        $search = trim((string) $request->query('q', ''));
        $dbProductsId = $this->toNullableInt($request->query('db_products_id'));
        $categoryProductsId = $this->toNullableInt($request->query('category_products_id'));

        $query = $this->missingImagesQuery($dbProductsId, $categoryProductsId)
            ->with('dbProduct')
            ->orderBy('name');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                    ->orWhere('sku', 'like', '%' . $search . '%');
            });
        }

        $products = $query->paginate(60)->withQueryString();

        return view('images', [
            'products' => $products,
            'q' => $search,
        ]);
    }

    public function actionDownload(Request $request, ProductMediaService $mediaService): JsonResponse
    {
        $product = $this->findProductForAction($request);
        if (!$product) {
            return response()->json(['ok' => false, 'message' => 'Produit introuvable'], 404);
        }

        return response()->json($mediaService->downloadMissing($product));
    }

    public function actionCompare(Request $request, ProductMediaService $mediaService): JsonResponse
    {
        $product = $this->findProductForAction($request);
        if (!$product) {
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
        if (!$product) {
            return response()->json(['ok' => false, 'message' => 'Produit introuvable'], 404);
        }

        return response()->json($mediaService->ensureThumbnail($product));
    }

    public function actionBatchDownload(Request $request, ProductMediaService $mediaService): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'min:1'],
        ]);

        $ids = array_values(array_unique(array_map('intval', $data['ids'])));
        $products = Product::query()->whereIn('id', $ids)->get()->keyBy('id');

        $processed = 0;
        $downloaded = 0;
        $failed = 0;
        $results = [];

        foreach ($ids as $id) {
            $product = $products->get($id);
            if (!$product) {
                $failed++;
                $results[] = ['id' => $id, 'ok' => false, 'message' => 'Produit introuvable'];
                continue;
            }

            $processed++;
            $result = $mediaService->downloadMissing($product);
            if (!empty($result['downloaded'])) {
                $downloaded++;
            }
            if (empty($result['ok'])) {
                $failed++;
            }

            $results[] = array_merge(['id' => $id], $result);
        }

        return response()->json([
            'ok' => true,
            'processed' => $processed,
            'downloaded' => $downloaded,
            'failed' => $failed,
            'results' => $results,
        ]);
    }

    private function missingImagesQuery(?int $dbProductsId, ?int $categoryProductsId)
    {
        $query = Product::query()
            ->where('active', true)
            ->whereNotNull('img_link')
            ->where('img_link', '!=', '')
            ->whereDoesntHave('media', function ($q) {
                $q->where('collection_name', 'images');
            })
            ->orderBy('id');

        if ($dbProductsId) {
            $query->where('db_products_id', $dbProductsId);
        }

        if ($categoryProductsId) {
            $query->where('category_products_id', $categoryProductsId);
        }

        return $query;
    }

    private function isRemoteUrl(?string $value): bool
    {
        if (!$value) {
            return false;
        }

        if (!filter_var($value, FILTER_VALIDATE_URL)) {
            return false;
        }

        return (bool) preg_match('#^https?://#i', $value);
    }

    private function toNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '' || $value === 'all') {
            return null;
        }

        if (!is_numeric($value)) {
            return null;
        }

        $int = (int) $value;
        return $int > 0 ? $int : null;
    }

    private function findProductForAction(Request $request): ?Product
    {
        $data = $request->validate([
            'id' => ['required', 'integer', 'min:1'],
        ]);

        return Product::query()->find((int) $data['id']);
    }
}
