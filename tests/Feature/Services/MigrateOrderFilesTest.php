<?php

use App\Models\Cart;
use App\Models\File;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

it('simulates then migrates historical PDFs without deleting unverified sources', function () {
    Storage::fake('public');
    Storage::fake('local');
    $client = User::factory()->withoutTwoFactor()->create();
    $cart = Cart::create(['user_id' => $client->id, 'status' => 'processing']);
    $path = 'commandes/'.$client->id.'/'.$cart->id.'_2026_09_13.pdf';
    Storage::disk('public')->put($path, 'historical pdf');

    $this->artisan('orders:migrate-files')->assertSuccessful();
    expect(File::count())->toBe(0);
    Storage::disk('public')->assertExists($path);

    $this->artisan('orders:migrate-files --apply')->assertSuccessful();
    $copy = File::firstOrFail();
    expect($copy->user_id)->toBe($client->id)->and($copy->cart_id)->toBe($cart->id);
    expect($copy->disk)->toBe('public');
    expect(Storage::disk('public')->get($copy->file_path))->toBe('historical pdf');
    Storage::disk('public')->assertExists($path);

    $this->artisan('orders:migrate-files --apply --retire-public')->assertSuccessful();
    Storage::disk('public')->assertMissing($path);
    expect(File::count())->toBe(1);
    $this->actingAs($client)->get(route('order-files.cart-pdf', $cart->id))->assertOk();
});

it('quarantines ambiguous public files without granting access or losing their contents', function () {
    Storage::fake('public');
    Storage::fake('local');
    Storage::disk('public')->put('commandes/123/unknown.pdf', 'unknown');
    $this->artisan('orders:migrate-files --apply --retire-public')->assertFailed();
    Storage::disk('public')->assertMissing('commandes/123/unknown.pdf');
    $quarantine = Storage::disk('local')->allFiles('order-file-migration/quarantine');
    expect($quarantine)->toHaveCount(1)
        ->and(Storage::disk('local')->get($quarantine[0]))->toBe('unknown');
    expect(File::count())->toBe(0);
});

it('does not remove neighboring user media when retiring a historical PDF', function () {
    Storage::fake('public');
    Storage::fake('local');
    $client = User::factory()->create();
    $cart = Cart::create(['user_id' => $client->id, 'status' => 'processing']);
    $media = $client->addMediaFromString('historical pdf')->usingFileName($cart->id.'_2026_09_13.pdf')
        ->withCustomProperties(['source' => 'cart-tcpdf'])->toMediaCollection('user_meta_files', 'public');
    $path = $media->getPathRelativeToRoot();
    $neighbor = dirname($path).'/logo.png';
    Storage::disk('public')->put($neighbor, 'logo');

    $this->artisan('orders:migrate-files --apply --retire-public')->assertSuccessful();
    Storage::disk('public')->assertMissing($path);
    Storage::disk('public')->assertExists($neighbor);
    expect($media->fresh())->toBeNull();
});
