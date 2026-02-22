<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductResource;
use App\Models\CategoryProducts;
use App\Models\DbProducts;
use App\Models\Product;
use App\Services\ProductMediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MediaController extends Controller
{
    public function index(Request $request)
    {
        $search = $request->get('q');
        $dbProductsId = $this->toNullableInt($request->input('db_products_id'));
        $categoryProductsId = $this->toNullableInt($request->input('category_products_id'));

        $applySearch = function ($q, ?string $search) {
            if (empty($search)) {
                return;
            }

            $refCandidate = null;
            if (str_contains($search, ':')) {
                $refCandidate = trim((string) strtok($search, ':'));
                if ($refCandidate === '') {
                    $refCandidate = null;
                }
            }

            if ($refCandidate) {
                $q->where('products.ref', '=', $refCandidate);
                return;
            }

            $normalized = trim($search);
            $tokens = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $isSingleNumeric = count($tokens) === 1 && ctype_digit($tokens[0]);
            $isSingleToken = count($tokens) === 1;

            $q->where(function ($qq) use ($tokens, $isSingleNumeric, $isSingleToken) {
                if ($isSingleNumeric) {
                    $qq->where('products.id', '=', (int) $tokens[0]);
                }

                $qq->orWhere(function ($qqq) use ($tokens) {
                    foreach ($tokens as $t) {
                        $qqq->where('products.name', 'like', '%' . $t . '%');
                    }
                });

                if ($isSingleToken) {
                    $qq->orWhere('products.ref', '=', $tokens[0]);
                }
            });
        };

        $query = $this->missingImagesQuery($dbProductsId, $categoryProductsId)
            ->with(['category', 'tags', 'dbProduct']);
        $applySearch($query, $search);
        $query->orderBy('name');

        $products = $query->paginate(24)->withQueryString();

        return Inertia::render('media/index', [
            'q' => $search,
            'filters' => [
                'db_products_id' => $dbProductsId,
                'category_products_id' => $categoryProductsId,
            ],
            'collection' => Inertia::scroll(fn() => ProductResource::collection($products)),
            'dbProducts' => DbProducts::query()
                ->orderBy('name')
                ->get(['id', 'name']),
            'categories' => CategoryProducts::query()
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
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

    private function missingImagesQuery(?int $dbProductsId, ?int $categoryProductsId)
    {
        $query = Product::query()
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
}
