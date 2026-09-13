<?php

use App\Models\DbProducts;
use App\Models\File;
use App\Models\Product;
use App\Models\User;
use App\Services\CartTcpdfService;
use App\Services\OrderSnapshotService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Spatie\LaravelPdf\Facades\Pdf;

it('stores private PDFs through both order endpoints and attaches each recipients copy', function (string $endpoint) {
    Storage::fake('local');
    Storage::fake('public');
    $client = User::factory()->withoutTwoFactor()->create();
    $billing = User::factory()->withoutTwoFactor()->create();
    $seller = User::factory()->withoutTwoFactor()->create();
    $database = DbProducts::create(['name' => 'Fleurs', 'description' => 'Test']);
    DB::table('db_product_user')->insert([
        'db_product_id' => $database->id, 'user_id' => $client->id,
        'attributes' => json_encode(['fact' => $billing->id, 'com' => $seller->id]),
    ]);
    $product = Product::create(['sku' => 'ORDER-FILE-TEST', 'name' => 'Rose', 'price' => 5, 'active' => true, 'db_products_id' => $database->id]);
    $this->mock(OrderSnapshotService::class)->shouldReceive('createFromPayload')->once();
    if ($endpoint === '/cart/order') {
        Pdf::shouldReceive('view')->once()->andReturn($builder = Mockery::mock());
        $builder->shouldReceive('format')->with('a4')->andReturnSelf();
        $builder->shouldReceive('base64')->andReturn(base64_encode('%PDF-rendered'));
    } else {
        $this->mock(CartTcpdfService::class)->shouldReceive('render')->once()->andReturn('%PDF-rendered');
    }
    $attachments = [];
    Mail::shouldReceive('raw')->times(3)->andReturnUsing(function ($text, $callback) use (&$attachments) {
        $message = new \Illuminate\Mail\Message(new \Symfony\Component\Mime\Email);
        $callback($message);
        $email = $message->getSymfonyMessage();
        $attachments[$email->getTo()[0]->getAddress()] = $email->getAttachments()[0]->getBody();
    });
    $response = $this->actingAs($client)->postJson($endpoint, ['items' => [['id' => $product->id, 'quantity' => 2]], 'choice' => 'new']);
    $response->assertOk();
    expect(File::count())->toBe(3)->and(Storage::disk('public')->allFiles())->toBe([]);
    foreach ([$client, $billing, $seller] as $owner) {
        $file = $owner->files()->sole();
        expect($file->file_path)->toStartWith('meta_user/'.$owner->id.'/commandes/');
        expect((string) $attachments[$owner->email])->toBe(Storage::disk('local')->path($file->file_path));
    }
    if ($endpoint === '/cart/order') {
        $this->get($response->json('pdf_download_url'))->assertOk()->assertDownload();
    } else {
        $response->assertContent('%PDF-rendered');
    }
})->with(['/cart/order', '/cart/generate-pdf-tcpdf']);
