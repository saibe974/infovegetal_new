<?php

declare(strict_types=1);

use App\Http\Controllers\MediaController;
use App\Models\Product;
use App\Services\ProductMediaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

function createMissingImageProduct(string $suffix, int $dbProductId, bool $active = true): Product
{
    return Product::query()->create([
        'sku' => "missing-image-{$suffix}",
        'name' => "Missing image {$suffix}",
        'img_link' => "https://example.test/{$suffix}.jpg",
        'price' => 10,
        'active' => $active,
        'attributes' => [],
        'db_products_id' => $dbProductId,
        'ref' => "ref-{$suffix}",
        'ean13' => str_pad((string) sprintf('%u', crc32($suffix)), 13, '0', STR_PAD_LEFT),
    ]);
}

function missingImagesPayload(array $query): array
{
    $request = Request::create('/admin/media-manager/images/items', 'GET', $query);
    $response = app(MediaController::class)->imageItems(
        $request,
        app(ProductMediaService::class),
    );

    return $response->getData(true);
}

it('lists missing images with a stable id cursor and excludes inactive or local products', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Missing images DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $first = createMissingImageProduct('alpha', $dbProductId);
    $second = createMissingImageProduct('beta', $dbProductId);
    $third = createMissingImageProduct('gamma', $dbProductId);
    createMissingImageProduct('inactive', $dbProductId, false);
    $third->media()->create([
        'collection_name' => 'images',
        'name' => 'ghost',
        'file_name' => 'ghost.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    $withMedia = createMissingImageProduct('local', $dbProductId);
    $validMedia = $withMedia->media()->create([
        'collection_name' => 'images',
        'name' => 'local',
        'file_name' => 'local.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    Storage::disk('public')->put($validMedia->getPathRelativeToRoot(), 'valid image');

    $pageOne = missingImagesPayload(['limit' => 2, 'after' => 0, 'with_total' => 1]);
    $pageTwo = missingImagesPayload(['limit' => 2, 'after' => $pageOne['next_cursor']]);

    expect(collect($pageOne['items'])->pluck('id')->all())->toBe([$first->id, $second->id])
        ->and($pageOne['total'])->toBe(3)
        ->and($pageOne['has_more'])->toBeTrue()
        ->and(collect($pageTwo['items'])->pluck('id')->all())->toBe([$third->id])
        ->and($pageTwo['items'][0]['missing_reason'])->toBe('missing_file')
        ->and($pageTwo['has_more'])->toBeFalse();
});

it('applies search and database filters to missing image candidates', function (): void {
    $firstDb = DB::table('db_products')->insertGetId([
        'name' => 'First DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $secondDb = DB::table('db_products')->insertGetId([
        'name' => 'Second DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $match = createMissingImageProduct('needle', $firstDb);
    createMissingImageProduct('other', $firstDb);
    createMissingImageProduct('needle-second-db', $secondDb);

    $payload = missingImagesPayload([
        'q' => 'needle',
        'db_products_id' => $firstDb,
        'with_total' => 1,
    ]);

    expect(collect($payload['items'])->pluck('id')->all())->toBe([$match->id])
        ->and($payload['total'])->toBe(1);
});

it('treats an already downloaded image as an idempotent success', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Idempotent DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $product = createMissingImageProduct('already-local', $dbProductId);
    $media = $product->media()->create([
        'collection_name' => 'images',
        'name' => 'already-local',
        'file_name' => 'already-local.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    Storage::disk('public')->put($media->getPathRelativeToRoot(), 'valid image');

    $result = app(ProductMediaService::class)->downloadMissing($product);

    expect($result['ok'])->toBeTrue()
        ->and($result['downloaded'])->toBeFalse()
        ->and($result['has_local'])->toBeTrue();
});

it('replaces a ghost media record by downloading the remote image', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Ghost repair DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $product = createMissingImageProduct('ghost-repair', $dbProductId);
    $ghost = $product->media()->create([
        'collection_name' => 'images',
        'name' => 'ghost-repair',
        'file_name' => 'ghost-repair.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    Http::fake([
        '*' => Http::response(
            file_get_contents(public_path('images/placeholder.png')),
            200,
            ['Content-Type' => 'image/png'],
        ),
    ]);

    $request = Request::create(
        '/admin/media-manager/images/action/download',
        'POST',
        ['id' => $product->id],
    );
    $response = app(MediaController::class)->actionDownload(
        $request,
        app(ProductMediaService::class),
    );
    $result = $response->getData(true);
    $newMedia = $product->fresh()?->getFirstMedia('images');

    expect($result['ok'])->toBeTrue()
        ->and($result['downloaded'])->toBeTrue()
        ->and($result['product']['sku'])->toBe($product->sku)
        ->and($result['product']['missing_reason'])->toBe('ok')
        ->and($newMedia)->not->toBeNull()
        ->and($newMedia?->id)->not->toBe($ghost->id)
        ->and(Storage::disk('public')->exists($newMedia->getPathRelativeToRoot()))->toBeTrue();
});

it('relocates an existing file found in another products folder', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Relocation DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $product = createMissingImageProduct('relocate', $dbProductId);
    $ghost = $product->media()->create([
        'collection_name' => 'images',
        'name' => 'relocate',
        'file_name' => 'ref-relocate.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    $imageBytes = file_get_contents(public_path('images/placeholder.png'));
    Storage::disk('public')->put('products/99999/ref-relocate.jpg', $imageBytes);

    $result = app(ProductMediaService::class)->downloadMissing($product);

    $newMedia = $product->fresh()?->getFirstMedia('images');

    expect($result['ok'])->toBeTrue()
        ->and($result['downloaded'])->toBeFalse()
        ->and($result['has_local'])->toBeTrue()
        ->and($newMedia)->not->toBeNull()
        ->and($newMedia?->id)->not->toBe($ghost->id)
        ->and($newMedia?->file_name)->toBe('ref-relocate.jpg')
        ->and($newMedia?->getCustomProperty('source_url'))->toBe($product->getRawOriginal('img_link'))
        ->and(Storage::disk('public')->exists($newMedia->getPathRelativeToRoot()))->toBeTrue()
        ->and(Storage::disk('public')->exists('products/99999/ref-relocate.jpg'))->toBeFalse();
});

it('adopts an orphan file matching the product reference', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Adoption DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $product = createMissingImageProduct('adopt', $dbProductId);
    $imageBytes = file_get_contents(public_path('images/placeholder.png'));
    Storage::disk('public')->put('products/88888/ref-adopt.jpg', $imageBytes);

    $result = app(ProductMediaService::class)->downloadMissing($product);

    $newMedia = $product->fresh()?->getFirstMedia('images');

    expect($result['ok'])->toBeTrue()
        ->and($result['downloaded'])->toBeFalse()
        ->and($newMedia)->not->toBeNull()
        ->and($newMedia?->getCustomProperty('source_url'))->toBe($product->getRawOriginal('img_link'))
        ->and(Storage::disk('public')->exists($newMedia->getPathRelativeToRoot()))->toBeTrue();
});

it('reuses a file attached to another product with the same source url', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Shared source DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $source = createMissingImageProduct('sibling', $dbProductId);
    $target = createMissingImageProduct('renamed', $dbProductId);
    $target->forceFill(['img_link' => $source->getRawOriginal('img_link')])->save();
    $imageBytes = file_get_contents(public_path('images/placeholder.png'));
    $sourceMedia = $source->media()->create([
        'collection_name' => 'images',
        'name' => 'sibling',
        'file_name' => 'ref-sibling.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => ['source_url' => $source->getRawOriginal('img_link')],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    Storage::disk('public')->put($sourceMedia->getPathRelativeToRoot(), $imageBytes);

    $result = app(ProductMediaService::class)->downloadMissing($target);

    $targetMedia = $target->fresh()?->getFirstMedia('images');

    expect($result['ok'])->toBeTrue()
        ->and($result['downloaded'])->toBeFalse()
        ->and($targetMedia)->not->toBeNull()
        ->and($targetMedia?->file_name)->toBe('ref-sibling.jpg')
        ->and($targetMedia?->getCustomProperty('source_url'))->toBe($source->getRawOriginal('img_link'))
        ->and(Storage::disk('public')->exists($targetMedia->getPathRelativeToRoot()))->toBeTrue()
        ->and($source->fresh()?->getFirstMedia('images')?->id)->toBe($sourceMedia->id)
        ->and(Storage::disk('public')->exists($sourceMedia->getPathRelativeToRoot()))->toBeTrue();
});

it('lists only products with an existing local file for comparison', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Compare DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $comparable = createMissingImageProduct('comparable', $dbProductId);
    $media = $comparable->media()->create([
        'collection_name' => 'images',
        'name' => 'comparable',
        'file_name' => 'ref-comparable.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    Storage::disk('public')->put($media->getPathRelativeToRoot(), 'valid image');

    $ghost = createMissingImageProduct('ghost-list', $dbProductId);
    $ghost->media()->create([
        'collection_name' => 'images',
        'name' => 'ghost-list',
        'file_name' => 'ref-ghost-list.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    createMissingImageProduct('without-media', $dbProductId);

    $request = Request::create(
        '/admin/media-manager/images/compare-items',
        'GET',
        ['limit' => 10, 'with_total' => 1],
    );
    $response = app(MediaController::class)->compareItems(
        $request,
        app(ProductMediaService::class),
    );
    $payload = $response->getData(true);

    expect(collect($payload['items'])->pluck('id')->all())->toBe([$comparable->id])
        ->and($payload['total'])->toBe(1)
        ->and($payload['items'][0]['local_url'])->not->toBeNull()
        ->and($payload['items'][0]['thumb_url'])->not->toBeNull()
        ->and($payload['items'][0]['source_url'])->toBe($comparable->getRawOriginal('img_link'));
});

it('compares a remote image with the local media by hash', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Compare action DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $product = createMissingImageProduct('compare-ok', $dbProductId);
    $media = $product->media()->create([
        'collection_name' => 'images',
        'name' => 'compare-ok',
        'file_name' => 'ref-compare-ok.jpg',
        'mime_type' => 'image/png',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    $imageBytes = file_get_contents(public_path('images/placeholder.png'));
    Storage::disk('public')->put($media->getPathRelativeToRoot(), $imageBytes);
    Http::fake([
        '*' => Http::response($imageBytes, 200, ['Content-Type' => 'image/png']),
    ]);

    $request = Request::create(
        '/admin/media-manager/images/action/compare',
        'POST',
        ['id' => $product->id],
    );
    $response = app(MediaController::class)->actionCompare(
        $request,
        app(ProductMediaService::class),
    );
    $payload = $response->getData(true);

    expect($payload['ok'])->toBeTrue()
        ->and($payload['same'])->toBeTrue()
        ->and($payload['product']['name'])->toBe($product->name)
        ->and($payload['product']['thumb_url'])->not->toBeNull();
    Http::assertSentCount(1);
});

it('reports an unreachable remote image during comparison', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Compare unreachable DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $product = createMissingImageProduct('compare-far', $dbProductId);
    $media = $product->media()->create([
        'collection_name' => 'images',
        'name' => 'compare-far',
        'file_name' => 'ref-compare-far.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    Storage::disk('public')->put($media->getPathRelativeToRoot(), 'valid image');
    Http::fake([
        '*' => Http::response('gone', 404),
    ]);

    $request = Request::create(
        '/admin/media-manager/images/action/compare',
        'POST',
        ['id' => $product->id],
    );
    $response = app(MediaController::class)->actionCompare(
        $request,
        app(ProductMediaService::class),
    );
    $payload = $response->getData(true);

    expect($payload['ok'])->toBeFalse()
        ->and($payload['reason'])->toBe('remote_unreachable')
        ->and($payload['product']['local_url'])->not->toBeNull();
});

it('replaces a different local image by re-downloading the remote source', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Refresh DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $product = createMissingImageProduct('refresh-diff', $dbProductId);
    $oldMedia = $product->media()->create([
        'collection_name' => 'images',
        'name' => 'refresh-diff',
        'file_name' => 'ref-refresh-diff.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => ['source_url' => $product->getRawOriginal('img_link')],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    Storage::disk('public')->put($oldMedia->getPathRelativeToRoot(), 'outdated bytes');
    $imageBytes = file_get_contents(public_path('images/placeholder.png'));
    Http::fake([
        '*' => Http::response($imageBytes, 200, ['Content-Type' => 'image/png']),
    ]);

    $request = Request::create(
        '/admin/media-manager/images/action/refresh',
        'POST',
        ['id' => $product->id],
    );
    $response = app(MediaController::class)->actionRefreshRemote(
        $request,
        app(ProductMediaService::class),
    );
    $payload = $response->getData(true);
    $newMedia = $product->fresh()?->getFirstMedia('images');

    expect($payload['ok'])->toBeTrue()
        ->and($payload['downloaded'])->toBeTrue()
        ->and($newMedia)->not->toBeNull()
        ->and($newMedia?->id)->not->toBe($oldMedia->id)
        ->and(Storage::disk('public')->get($newMedia->getPathRelativeToRoot()))->toBe($imageBytes)
        ->and($payload['product']['local_url'])->not->toBeNull();
});

it('refuses to refresh when the remote url is invalid', function (): void {
    Storage::fake('public');
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Refresh invalid DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $product = createMissingImageProduct('refresh-bad', $dbProductId);
    $product->forceFill(['img_link' => 'not-a-url'])->save();
    Http::preventStrayRequests();

    $request = Request::create(
        '/admin/media-manager/images/action/refresh',
        'POST',
        ['id' => $product->id],
    );
    $response = app(MediaController::class)->actionRefreshRemote(
        $request,
        app(ProductMediaService::class),
    );
    $payload = $response->getData(true);

    expect($payload['ok'])->toBeFalse()
        ->and($payload['downloaded'])->toBeFalse();
    Http::assertNothingSent();
});

it('force removes img_link without checking the remote server', function (): void {
    $dbProductId = DB::table('db_products')->insertGetId([
        'name' => 'Force removal DB',
        'country' => 'FR',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $product = createMissingImageProduct('force-removal', $dbProductId);
    $product->media()->create([
        'collection_name' => 'images',
        'name' => 'badly-saved-image',
        'file_name' => 'badly-saved-image.jpg',
        'mime_type' => 'image/jpeg',
        'disk' => 'public',
        'conversions_disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [],
        'generated_conversions' => [],
        'responsive_images' => [],
    ]);
    Http::preventStrayRequests();

    $request = Request::create(
        '/admin/media-manager/images/action/remove-missing-img-link',
        'POST',
        ['id' => $product->id, 'force' => true],
    );
    $response = app(MediaController::class)->actionRemoveMissingImgLink(
        $request,
        app(ProductMediaService::class),
    );
    $result = $response->getData(true);

    expect($result['ok'])->toBeTrue()
        ->and($result['removed'])->toBeTrue()
        ->and($result['media_removed'])->toBe(1)
        ->and($result['preview_url'])->toBeNull()
        ->and($product->fresh()?->getRawOriginal('img_link'))->toBeNull()
        ->and($product->fresh()?->media()->where('collection_name', 'images')->count())->toBe(0);
    Http::assertNothingSent();
});
