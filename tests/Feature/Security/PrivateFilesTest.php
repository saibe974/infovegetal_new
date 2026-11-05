<?php

use App\Models\User;
use Illuminate\Support\Facades\Storage;

test('privatization is repeatable and reversible without touching public images', function () {
    Storage::fake('public');
    Storage::fake('local');
    $user = User::factory()->create();
    $path = 'user-meta/'.$user->id.'/commandes/2026/11/test.pdf';
    Storage::disk('public')->put($path, '%PDF-test');
    Storage::disk('public')->put('products/photo.jpg', 'public image');
    $file = $user->files()->create(['file_path' => $path, 'file_name' => 'test.pdf', 'file_size' => 9, 'disk' => 'public', 'mime' => 'application/pdf']);
    $this->artisan('security:privatize-files')->assertSuccessful();
    Storage::disk('public')->assertExists($path);
    $this->artisan('security:privatize-files --apply')->assertSuccessful();
    $this->artisan('security:privatize-files --apply')->assertSuccessful();
    expect($file->fresh()->disk)->toBe('local');
    Storage::disk('public')->assertMissing($path);
    expect(Storage::disk('local')->get($path))->toBe('%PDF-test');
    Storage::disk('public')->assertExists('products/photo.jpg');
    $this->actingAs(User::factory()->create())->get(route('order-files.download', $file->id))->assertNotFound();
    $this->actingAs($user)->get(route('order-files.download', $file->id))->assertOk();
    $this->artisan('security:privatize-files --apply --rollback')->assertSuccessful();
    expect($file->fresh()->disk)->toBe('public');
    expect(Storage::disk('public')->get($path))->toBe('%PDF-test');
});

test('privatization refuses a conflicting destination and preserves the source', function () {
    Storage::fake('public');
    Storage::fake('local');
    Storage::disk('public')->put('imports/test.csv', 'original');
    Storage::disk('local')->put('imports/test.csv', 'different');
    expect(fn () => $this->artisan('security:privatize-files --apply')->run())->toThrow(RuntimeException::class);
    expect(Storage::disk('public')->get('imports/test.csv'))->toBe('original');
});

test('a rollback refuses a public file changed after migration', function () {
    Storage::fake('public');
    Storage::fake('local');
    Storage::disk('public')->put('imports/test.csv', 'original');
    $this->artisan('security:privatize-files --apply')->assertSuccessful();
    Storage::disk('public')->put('imports/test.csv', 'new public data');
    expect(fn () => $this->artisan('security:privatize-files --apply --rollback')->run())->toThrow(RuntimeException::class);
    expect(Storage::disk('public')->get('imports/test.csv'))->toBe('new public data')
        ->and(Storage::disk('local')->get('imports/test.csv'))->toBe('original');
});

test('historical document media move privately while neighboring profile images stay public', function () {
    Storage::fake('public');
    Storage::fake('local');
    $user = User::factory()->create();
    $media = $user->addMediaFromString('%PDF-test')->usingFileName('historical.pdf')
        ->withCustomProperties(['source' => 'cart-tcpdf'])->toMediaCollection('user_meta_files', 'public');
    $path = $media->getPathRelativeToRoot();
    $logo = dirname($path).'/logo.png';
    Storage::disk('public')->put($logo, 'public logo');
    $this->artisan('security:privatize-files --apply')->assertSuccessful();
    expect($media->fresh()->disk)->toBe('local');
    Storage::disk('public')->assertMissing($path);
    Storage::disk('public')->assertExists($logo);
    expect(Storage::disk('local')->get($path))->toBe('%PDF-test');
    $this->artisan('security:privatize-files --apply --rollback')->assertSuccessful();
    expect($media->fresh()->disk)->toBe('public');
    Storage::disk('public')->assertExists([$path, $logo]);
});
