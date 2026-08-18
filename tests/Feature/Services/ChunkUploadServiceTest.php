<?php

use App\Models\User;
use App\Services\ChunkUploadService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

test('it assembles uploaded chunks through streams', function () {
    Storage::fake('local');
    $this->actingAs(User::factory()->create());

    $service = app(ChunkUploadService::class);
    $uploadId = 'streaming-upload-test';
    $contents = 'first-partsecond-part';

    $start = Request::create('/upload', 'POST', server: [
        'HTTP_UPLOAD_ID' => $uploadId,
        'HTTP_UPLOAD_NAME' => 'large-products.csv',
        'HTTP_UPLOAD_LENGTH' => (string) strlen($contents),
    ]);
    $start->setLaravelSession(app('session')->driver());

    $startResponse = $service->handleChunkUpload($start);
    expect($startResponse->getData(true)['status'])->toBe('chunk_received');

    $firstChunk = Request::create('/upload', 'PATCH', server: [
        'HTTP_UPLOAD_ID' => $uploadId,
        'HTTP_UPLOAD_OFFSET' => '0',
    ], content: 'first-part');
    $firstChunk->setLaravelSession(app('session')->driver());

    $firstResponse = $service->handleChunkUpload($firstChunk);
    expect($firstResponse->getData(true)['status'])->toBe('chunk_received');

    $secondChunk = Request::create('/upload', 'PATCH', server: [
        'HTTP_UPLOAD_ID' => $uploadId,
        'HTTP_UPLOAD_OFFSET' => (string) strlen('first-part'),
    ], content: 'second-part');
    $secondChunk->setLaravelSession(app('session')->driver());

    $response = $service->handleChunkUpload($secondChunk);
    $payload = $response->getData(true);

    expect($payload['file'])->toBe('large-products.csv')
        ->and(Storage::disk('local')->get($payload['path']))->toBe($contents)
        ->and(Storage::disk('local')->exists("chunks/{$uploadId}"))->toBeFalse();
});
