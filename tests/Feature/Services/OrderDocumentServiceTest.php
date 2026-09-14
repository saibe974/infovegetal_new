<?php

use App\Models\Cart;
use App\Models\File;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderDocumentService;
use App\Services\PdfRollDistributionService;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Storage::fake('local');
    Storage::fake('public');
    $this->client = User::factory()->withoutTwoFactor()->create();
    $this->cart = Cart::create(['user_id' => $this->client->id, 'status' => 'processing']);
    $this->documents = app(OrderDocumentService::class);
});

it('keeps one record and the original period when a document is regenerated', function () {
    $first = $this->documents->store($this->cart, $this->client->id, 'order-pdf', 'commande.pdf', 'first', 'application/pdf', ['document_date' => '2025-12-31']);
    $second = $this->documents->store($this->cart, $this->client->id, 'order-pdf', 'commande.pdf', 'second', 'application/pdf', ['document_date' => '2026-01-01']);

    expect($second['file_id'])->toBe($first['file_id'])
        ->and($second['relative_path'])->toStartWith('user-meta/'.$this->client->id.'/commandes/2025/12/')
        ->and(File::count())->toBe(1);
    Storage::disk('public')->assertMissing($first['relative_path']);
    Storage::disk('public')->assertExists($second['relative_path']);
    expect(Storage::disk('local')->allFiles())->toBe([]);
});

it('prevents collisions between orders using the same display filename', function () {
    $otherCart = Cart::create(['user_id' => $this->client->id, 'status' => 'processing']);
    $first = $this->documents->store($this->cart, $this->client->id, 'order-pdf', 'commande.pdf', 'first', 'application/pdf');
    $second = $this->documents->store($otherCart, $this->client->id, 'order-pdf', 'commande.pdf', 'second', 'application/pdf');
    expect($second['relative_path'])->not->toBe($first['relative_path']);
    Storage::disk('public')->assertExists([$first['relative_path'], $second['relative_path']]);
});

it('serves only the authenticated owner even when the visitor is an administrator', function () {
    $copy = $this->documents->store($this->cart, $this->client->id, 'order-pdf', 'commande.pdf', '%PDF-test', 'application/pdf');
    $admin = User::factory()->withoutTwoFactor()->create();
    $admin->assignRole(Role::findOrCreate('admin', 'web'));

    $this->get($copy['download_url'])->assertRedirect();
    $this->actingAs($admin)->get($copy['download_url'])->assertNotFound();
    $this->get(route('order-files.preview', $copy['file_id']))->assertNotFound();
    $this->get(route('order-files.cart-pdf', $this->cart->id))->assertNotFound();
    $this->actingAs($this->client)->get($copy['download_url'])->assertOk()->assertDownload('commande.pdf');
    $this->get(route('order-files.preview', $copy['file_id']))->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
    $this->get(route('order-files.cart-pdf', $this->cart->id))->assertOk();
});

it('lists personal files with year and month filters', function () {
    $other = User::factory()->create();
    $this->documents->store($this->cart, $this->client->id, 'order-pdf', 'mine.pdf', 'mine', 'application/pdf', ['document_date' => '2025-12-31']);
    $this->documents->store($this->cart, $other->id, 'order-pdf', 'other.pdf', 'other', 'application/pdf');
    $this->actingAs($this->client)->get('/settings/files?year=2025&month=12')->assertInertia(fn (Assert $page) => $page
        ->component('settings/files')->has('files.data', 1)->where('files.data.0.name', 'mine.pdf')->where('years', ['2025']));
    $this->get('/settings/files?month=1')->assertInertia(fn (Assert $page) => $page->has('files.data', 0));
});

it('rejects missing files and forged paths even on a record owned by the caller', function () {
    $copy = $this->documents->store($this->cart, $this->client->id, 'order-pdf', 'mine.pdf', 'mine', 'application/pdf');
    Storage::disk('public')->delete($copy['relative_path']);
    $this->actingAs($this->client)->get($copy['download_url'])->assertNotFound();
    File::find($copy['file_id'])->update(['file_path' => 'user-meta/'.$this->client->id.'/commandes/../secret.pdf']);
    $this->get($copy['download_url'])->assertNotFound();
});

it('creates one personal PDF per actor with only their databases and totals', function () {
    $billing = User::factory()->create();
    $seller = User::factory()->create();
    $otherBilling = User::factory()->create();
    $this->mock(PdfRollDistributionService::class)->shouldReceive('build')->andReturn(['suppliers' => []]);
    $payload = [
        'items' => collect([
            ['product' => new Product(['db_products_id' => 1]), 'line_total' => 100],
            ['product' => new Product(['db_products_id' => 2]), 'line_total' => 200],
        ]),
        'items_total' => 300, 'shipping_total' => 30, 'total' => 325, 'discount_total' => 5,
        'transport_breakdown' => ['by_db' => [1 => 10, 2 => 20]],
        'discounts' => [1 => ['amount' => 5]],
        'billing_context_by_db' => [
            1 => ['billing_user_id' => $billing->id, 'seller_user_id' => $seller->id],
            2 => ['billing_user_id' => $otherBilling->id, 'seller_user_id' => $otherBilling->id],
        ],
    ];
    $copies = $this->documents->storePdfs($this->cart, $this->client, $payload, 'commande.pdf', fn ($scoped) => json_encode(['bases' => $scoped['items']->map(fn ($item) => $item['product']->db_products_id)->all(), 'total' => $scoped['total']]));
    expect($copies)->toHaveCount(4)->and(File::count())->toBe(4);
    expect(json_decode(Storage::disk('public')->get($copies[$billing->id]['relative_path']), true))->toBe(['bases' => [1], 'total' => 105]);
    expect(json_decode(Storage::disk('public')->get($copies[$otherBilling->id]['relative_path']), true))->toBe(['bases' => [2], 'total' => 220]);
    expect(json_decode(Storage::disk('public')->get($copies[$this->client->id]['relative_path']), true))->toBe(['bases' => [1, 2], 'total' => 325]);
    expect($copies[$billing->id]['relative_path'])->not->toBe($copies[$seller->id]['relative_path']);
});

it('does not publish a file record if writing fails', function () {
    Storage::shouldReceive('disk')->with('public')->andReturn($disk = Mockery::mock());
    $disk->shouldReceive('put')->once()->andReturn(false);
    expect(fn () => $this->documents->store($this->cart, $this->client->id, 'order-pdf', 'test.pdf', 'test', 'application/pdf'))->toThrow(RuntimeException::class);
    expect(File::count())->toBe(0);
});
