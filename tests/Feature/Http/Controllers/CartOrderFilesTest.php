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
    $product = Product::create([
        'sku' => 'ORDER-FILE-TEST',
        'name' => 'Rose',
        'description' => null,
        'img_link' => null,
        'price' => 5,
        'active' => true,
        'attributes' => [],
        'category_products_id' => null,
        'db_products_id' => $database->id,
        'ref' => 'ORDER-FILE-TEST',
        'ean13' => '0000000000000',
        'pot' => null,
        'height' => null,
        'price_floor' => 5,
        'price_roll' => 5,
        'price_promo' => 0,
        'producer_id' => null,
        'tva_id' => null,
        'cond' => 1,
        'floor' => 1,
        'roll' => 1,
        'unite' => null,
    ]);
    $this->mock(OrderSnapshotService::class)->shouldReceive('createFromPayload')->once();
    if ($endpoint === '/cart/order') {
        Pdf::swap(new class
        {
            public function view(string $view, array $payload): object
            {
                return new class
                {
                    public function format(string $format): self
                    {
                        return $this;
                    }

                    public function base64(): string
                    {
                        return base64_encode('%PDF-rendered');
                    }
                };
            }
        });
    } else {
        $this->mock(CartTcpdfService::class)->shouldReceive('render')->once()->andReturn('%PDF-rendered');
    }
    $attachments = [];
    Mail::shouldReceive('raw')->times(3)->andReturnUsing(function ($text, $callback) use (&$attachments) {
        $message = new \Illuminate\Mail\Message(new \Symfony\Component\Mime\Email);
        $callback($message);
        $email = $message->getSymfonyMessage();
        $attachment = $email->getAttachments()[0];
        $attachments[$email->getTo()[0]->getAddress()] = [
            'body' => $attachment->getBody(),
            'filename' => $attachment->getFilename(),
        ];
    });
    $response = $this->actingAs($client)->postJson($endpoint, ['items' => [['id' => $product->id, 'quantity' => 2]], 'choice' => 'new']);
    $response->assertOk();
    expect(File::count())->toBe(3)
        ->and(collect(Storage::disk('public')->allFiles())->every(fn ($path) => str_starts_with($path, 'user-meta/')))->toBeTrue();
    foreach ([$client, $billing, $seller] as $owner) {
        $file = $owner->files()->sole();
        expect($file->file_path)->toStartWith('user-meta/'.$owner->id.'/commandes/');
        expect((string) $attachments[$owner->email]['body'])->toBe('%PDF-rendered')
            ->and($attachments[$owner->email]['filename'])->toBe($file->file_name);
    }
    if ($endpoint === '/cart/order') {
        $this->get($response->json('pdf_download_url'))->assertOk()->assertDownload();
    } else {
        $response->assertContent('%PDF-rendered');
    }
})->with(['/cart/order', '/cart/generate-pdf-tcpdf']);
