<?php

use App\Models\Cart;
use App\Models\DbProducts;
use App\Models\Product;
use App\Models\User;
use App\Services\CartTcpdfService;
use App\Services\OrderWorkflowService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

function workflowFixture(): array
{
    $client = User::factory()->withoutTwoFactor()->create(['ref' => 'CLI042']);
    $billing = User::factory()->withoutTwoFactor()->create();
    $seller = User::factory()->withoutTwoFactor()->create();
    $database = DbProducts::create(['name' => 'Workflow', 'description' => 'Test']);
    $client->dbProducts()->attach($database->id, [
        'can_buy' => true, 'can_access' => true,
        'attributes' => json_encode(['fact' => $billing->id, 'com' => $seller->id]),
    ]);
    $product = Product::create([
        'sku' => 'WF-'.Str::uuid(), 'name' => 'Rose', 'ref' => 'ROSE', 'price' => 5,
        'price_floor' => 5, 'price_roll' => 5, 'price_promo' => 0,
        'active' => true, 'attributes' => [], 'ean13' => '0000000000000',
        'db_products_id' => $database->id, 'cond' => 1, 'floor' => 1, 'roll' => 1,
    ]);
    $cart = Cart::create(['user_id' => $client->id, 'status' => 'processing']);
    $cart->products()->attach($product->id, ['quantity' => 10]);
    $cart->workflow = ['participants' => [$billing->id, $seller->id], 'lines' => [[
        'product_id' => $product->id, 'db_id' => $database->id, 'name' => 'Rose', 'ref' => 'ROSE',
        'ordered_quantity' => 10, 'quantity' => 10, 'unit_price' => 5, 'tva_rate' => 20,
        'shipping' => 2, 'discount_rate' => 0.1, 'billing_user_id' => $billing->id,
        'seller_user_id' => $seller->id, 'client_comment' => 'Client initial',
    ]]];
    $cart->save();

    return compact('client', 'billing', 'seller', 'database', 'product', 'cart');
}

function workflowAction($test, array $fixture, User $actor, string $action)
{
    $cart = $fixture['cart']->fresh();

    return $test->actingAs($actor)->post('/orders/'.$cart->id.'/actions', ['revision' => $cart->revision, 'action' => $action]);
}

it('locks submitted orders against client edits, reactivation and deletion', function () {
    $f = workflowFixture();
    $id = $f['cart']->id;
    $this->actingAs($f['client'])->putJson("/cart/$id/status", ['status' => 'current'])->assertForbidden();
    $this->deleteJson("/cart/$id")->assertForbidden();
    $this->postJson('/cart/remove', ['product_id' => $f['product']->id])->assertOk();
    $this->postJson('/cart/add', ['product_id' => $f['product']->id, 'quantity' => 1])->assertOk();
    expect($f['cart']->products()->sole()->pivot->quantity)->toBe(10);
    $this->putJson("/orders/$id/lines", ['revision' => 0, 'lines' => [['product_id' => $f['product']->id, 'quantity' => 4]]])->assertForbidden();
    workflowAction($this, $f, $f['client'], 'ship')->assertForbidden();
    expect($f['cart']->fresh()->workflow['lines'][0]['quantity'])->toBe(10);
});

it('allows only assigned professionals to prepare products and rejects stale revisions', function () {
    $f = workflowFixture();
    $url = '/orders/'.$f['cart']->id.'/lines';
    $payload = ['revision' => 0, 'lines' => [['product_id' => $f['product']->id, 'quantity' => 8]]];
    $other = User::factory()->withoutTwoFactor()->create();
    $this->actingAs($other)->putJson($url, $payload)->assertForbidden();
    $this->actingAs($f['seller'])->put($url, $payload)->assertRedirect();
    expect($f['cart']->fresh()->workflow['lines'][0])->toMatchArray(['quantity' => 8, 'ordered_quantity' => 10]);
    $this->actingAs($f['billing'])->putJson($url, $payload)->assertConflict();
    workflowAction($this, $f, $f['billing'], 'ship')->assertRedirect();
    $cart = $f['cart']->fresh();
    expect($cart->status)->toBe('delivering')->and($cart->workflow['lines'][0]['shipped_quantity'])->toBe(8);
    $payload['revision'] = $cart->revision;
    $this->putJson($url, $payload)->assertForbidden();
    expect($cart->documents()->sole()->snapshot['lines'][0]['quantity'])->toBe(8);
});

it('lets professionals add an authorized product and remove a prepared product without losing the initial quantities', function () {
    $f = workflowFixture();
    $product = $f['product']->replicate();
    $product->sku = 'WF-ADDED';
    $product->ref = 'ADDED';
    $product->save();
    $this->actingAs($f['billing'])->put('/orders/'.$f['cart']->id.'/lines', [
        'revision' => 0, 'lines' => [
            ['product_id' => $f['product']->id, 'quantity' => 0],
            ['product_id' => $product->id, 'quantity' => 3],
        ],
    ])->assertRedirect();
    $lines = $f['cart']->fresh()->workflow['lines'];
    expect($lines[0]['quantity'])->toBe(0)->and($lines[0]['ordered_quantity'])->toBe(10)
        ->and($lines[1]['quantity'])->toBe(3)->and($lines[1]['ordered_quantity'])->toBe(0)
        ->and($lines[1]['unit_price'])->toBeGreaterThan(0);
});

it('requires a professional decision and issues immutable invoices and incremental credits', function () {
    $f = workflowFixture();
    $cart = $f['cart'];
    $url = '/orders/'.$cart->id;
    workflowAction($this, $f, $f['billing'], 'ship')->assertRedirect();
    workflowAction($this, $f, $f['seller'], 'deliver')->assertRedirect();
    $this->actingAs($f['billing'])->put($url.'/numbering', ['pattern' => '%date%-%ref_client%-%n°commande%'])->assertRedirect();
    $this->actingAs($f['client'])->post($url.'/issues', [
        'revision' => $cart->fresh()->revision, 'product_id' => $f['product']->id,
        'kind' => 'missing', 'quantity' => 2, 'comment' => 'Deux roses manquantes',
    ])->assertRedirect();
    $issue = $cart->issues()->sole();
    $decision = ['revision' => $cart->fresh()->revision, 'status' => 'approved', 'resolution' => 'Manquants confirmés'];
    $this->putJson($url.'/issues/'.$issue->id, $decision)->assertForbidden();
    workflowAction($this, $f, $f['billing'], 'invoice')->assertSessionHasErrors('order');
    $this->actingAs($f['seller'])->put($url.'/issues/'.$issue->id, $decision)->assertRedirect();
    workflowAction($this, $f, $f['seller'], 'invoice')->assertForbidden();
    workflowAction($this, $f, $f['billing'], 'invoice')->assertRedirect();
    $invoice = $cart->documents()->where('kind', 'invoice')->sole();
    expect($invoice->number)->toBe(now()->format('Ymd').'-CLI042-'.str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT))
        ->and($invoice->snapshot['lines'][0]['quantity'])->toBe(8)
        ->and($invoice->snapshot['total_ht'])->toEqual(37.8)
        ->and($invoice->snapshot['total_tva'])->toEqual(7.56);
    workflowAction($this, $f, $f['billing'], 'invoice')->assertSessionHasErrors('order');
    $original = $invoice->snapshot;
    $this->actingAs($f['client'])->get($url.'/documents/'.$invoice->id)->assertOk()->assertHeader('Content-Type', 'application/pdf');
    $this->actingAs($f['billing'])->put($url.'/numbering', ['pattern' => 'FACT-%compteur%'])->assertRedirect();
    $this->actingAs($f['client'])->post($url.'/issues', [
        'revision' => $cart->fresh()->revision, 'product_id' => $f['product']->id,
        'kind' => 'damaged', 'quantity' => 1, 'comment' => 'Une rose abîmée',
    ])->assertRedirect();
    $lateIssue = $cart->issues()->latest('id')->first();
    $this->actingAs($f['billing'])->put($url.'/issues/'.$lateIssue->id, [
        'revision' => $cart->fresh()->revision, 'status' => 'approved', 'resolution' => 'Photo vérifiée',
    ])->assertRedirect();
    workflowAction($this, $f, $f['billing'], 'close')->assertSessionHasErrors('order');
    workflowAction($this, $f, $f['billing'], 'credit')->assertRedirect();
    $credit = $cart->documents()->where('kind', 'credit')->sole();
    $this->actingAs($f['client'])->get($url.'/documents/'.$credit->id)->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect($credit->invoice_id)->toBe($invoice->id)->and($credit->snapshot['total_ht'])->toEqual(4.5)
        ->and($invoice->fresh()->snapshot)->toBe($original);
    workflowAction($this, $f, $f['billing'], 'credit')->assertSessionHasErrors('order');
    workflowAction($this, $f, $f['seller'], 'close')->assertRedirect();
    expect($cart->fresh()->status)->toBe('closed');
    $this->actingAs($f['client'])->postJson($url.'/issues', [
        'revision' => $cart->fresh()->revision, 'product_id' => $f['product']->id,
        'kind' => 'missing', 'quantity' => 1, 'comment' => 'Trop tard',
    ])->assertForbidden();
});

it('bounds cumulative claims and does not accept duplicate decisions', function () {
    $f = workflowFixture();
    $cart = $f['cart'];
    $url = '/orders/'.$cart->id;
    workflowAction($this, $f, $f['billing'], 'ship');
    workflowAction($this, $f, $f['billing'], 'deliver');
    $report = ['product_id' => $f['product']->id, 'kind' => 'missing', 'quantity' => 7, 'comment' => 'Manquants'];
    $this->actingAs($f['client'])->post($url.'/issues', $report + ['revision' => $cart->fresh()->revision])->assertRedirect();
    $this->post($url.'/issues', $report + ['revision' => $cart->fresh()->revision])->assertSessionHasErrors('order');
    $issue = $cart->issues()->sole();
    $this->actingAs($f['billing'])->put($url.'/issues/'.$issue->id, [
        'revision' => $cart->fresh()->revision, 'status' => 'rejected', 'resolution' => 'Livraison complète',
    ])->assertRedirect();
    $this->put($url.'/issues/'.$issue->id, [
        'revision' => $cart->fresh()->revision, 'status' => 'approved', 'resolution' => 'Autre avis',
    ])->assertSessionHasErrors('order');
    expect(app(OrderWorkflowService::class)->acceptedQuantity($cart->fresh(), $cart->workflow['lines'][0]))->toBe(10);
});

it('shares attributed comments and documents with participants while blocking unrelated users', function () {
    $f = workflowFixture();
    $cart = $f['cart'];
    $url = '/orders/'.$cart->id;
    $this->actingAs($f['seller'])->post($url.'/comments', ['revision' => 0, 'body' => 'Préparation demain'])->assertRedirect();
    $this->actingAs($f['client'])->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('orders/show')->where('order.comments.0.author_role', 'commercial')->where('order.comments.0.body', 'Préparation demain'));
    workflowAction($this, $f, $f['billing'], 'ship')->assertRedirect();
    $doc = $cart->documents()->sole();
    $this->actingAs($f['client'])->get($url.'/documents/'.$doc->id)->assertOk()->assertHeader('Content-Type', 'application/pdf');
    $other = User::factory()->withoutTwoFactor()->create();
    $this->actingAs($other)->get($url)->assertForbidden();
    $this->get($url.'/documents/'.$doc->id)->assertForbidden();
    $this->actingAs($f['seller'])->get('/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->has('carts', 1));
});

it('promotes the saved cart without changing its number and blocks client append requests', function () {
    Storage::fake('public');
    Mail::fake();
    $f = workflowFixture();
    $f['cart']->status = 'current';
    $f['cart']->workflow = null;
    $f['cart']->save();
    $this->mock(CartTcpdfService::class)->shouldReceive('render')->andReturn('%PDF-test');
    $payload = ['cart_id' => $f['cart']->id, 'items' => [['id' => $f['product']->id, 'quantity' => 4]], 'submission_key' => (string) Str::uuid()];
    $this->actingAs($f['client'])->postJson('/cart/generate-pdf-tcpdf', $payload)->assertOk()->assertHeader('X-Order-Id', (string) $f['cart']->id);
    $cart = $f['cart']->fresh();
    expect($cart->status)->toBe('processing')->and(Cart::count())->toBe(1)
        ->and($cart->workflow['lines'][0]['ordered_quantity'])->toBe(4)
        ->and($cart->workflow['participants'])->toContain($f['billing']->id);
    $this->postJson('/cart/generate-pdf-tcpdf', $payload)->assertConflict();
    $this->postJson('/cart/order', ['items' => $payload['items'], 'choice' => 'append'])->assertUnprocessable();
    $this->postJson('/cart/save', $payload)->assertConflict();
    expect($cart->fresh()->products()->sole()->pivot->quantity)->toBe(4);
});

it('rolls back submission when document rendering fails and keeps the draft editable', function () {
    $f = workflowFixture();
    $cart = $f['cart'];
    $cart->status = 'current';
    $cart->workflow = null;
    $cart->save();
    $this->mock(CartTcpdfService::class)->shouldReceive('render')->andThrow(new RuntimeException('Renderer unavailable'));
    $this->actingAs($f['client'])->postJson('/cart/generate-pdf-tcpdf', [
        'cart_id' => $cart->id, 'items' => [['id' => $f['product']->id, 'quantity' => 2]],
    ])->assertServerError();
    expect($cart->fresh()->status)->toBe('current')->and($cart->fresh()->workflow)->toBeNull()
        ->and($cart->products()->sole()->pivot->quantity)->toBe(10)
        ->and($cart->orderHeaders()->count())->toBe(0);
});

it('rejects unknown numbering variables and leaves invoice numbers unchanged after settings updates', function () {
    $f = workflowFixture();
    $url = '/orders/'.$f['cart']->id.'/numbering';
    $this->actingAs($f['client'])->putJson($url, ['pattern' => '%compteur%'])->assertForbidden();
    $this->actingAs($f['billing'])->put($url, ['pattern' => '%inconnu%'])->assertSessionHasErrors('pattern');
    $this->put($url, ['pattern' => '../%compteur%'])->assertSessionHasErrors('pattern');
    expect(DB::table('invoice_number_settings')->count())->toBe(0);
});

it('keeps preparation, decisions and invoice issuance scoped to each assigned billing party', function () {
    $f = workflowFixture();
    $cart = $f['cart'];
    $otherBilling = User::factory()->withoutTwoFactor()->create();
    $otherProduct = $f['product']->replicate();
    $otherProduct->sku = 'OTHER-PARTY';
    $otherProduct->save();
    $workflow = $cart->workflow;
    $otherLine = $workflow['lines'][0];
    $otherLine['product_id'] = $otherProduct->id;
    $otherLine['billing_user_id'] = $otherBilling->id;
    $otherLine['seller_user_id'] = null;
    $workflow['lines'][] = $otherLine;
    $workflow['participants'][] = $otherBilling->id;
    $cart->workflow = $workflow;
    $cart->save();
    $this->actingAs($f['billing'])->putJson('/orders/'.$cart->id.'/lines', [
        'revision' => 0, 'lines' => [['product_id' => $otherProduct->id, 'quantity' => 3]],
    ])->assertForbidden();
    workflowAction($this, $f, $f['billing'], 'ship')->assertRedirect();
    workflowAction($this, $f, $otherBilling, 'deliver')->assertRedirect();
    workflowAction($this, $f, $f['billing'], 'invoice')->assertRedirect();
    $invoice = $cart->documents()->where('kind', 'invoice')->sole();
    expect(collect($invoice->snapshot['lines'])->pluck('product_id')->all())->toBe([$f['product']->id]);
    workflowAction($this, $f, $f['billing'], 'close')->assertSessionHasErrors('order');
    workflowAction($this, $f, $otherBilling, 'invoice')->assertRedirect();
    expect($cart->documents()->where('kind', 'invoice')->count())->toBe(2);
    workflowAction($this, $f, $f['billing'], 'close')->assertRedirect();
});

it('prevents duplicate invoice numbers across orders and does not consume the counter on failure', function () {
    $f = workflowFixture();
    $cart = $f['cart'];
    workflowAction($this, $f, $f['billing'], 'ship');
    workflowAction($this, $f, $f['billing'], 'deliver');
    $this->actingAs($f['billing'])->put('/orders/'.$cart->id.'/numbering', ['pattern' => 'FIXED']);
    workflowAction($this, $f, $f['billing'], 'invoice')->assertRedirect();
    $second = Cart::create(['user_id' => $f['client']->id, 'status' => 'delivered']);
    $second->workflow = $cart->fresh()->workflow;
    $second->save();
    $secondFixture = array_replace($f, ['cart' => $second]);
    workflowAction($this, $secondFixture, $f['billing'], 'invoice')->assertSessionHasErrors('pattern');
    expect($second->documents()->count())->toBe(0)
        ->and(DB::table('invoice_number_settings')->where('user_id', $f['billing']->id)->value('next_number'))->toBe(2);
    $this->put('/orders/'.$second->id.'/numbering', ['pattern' => 'FACT-%compteur%']);
    workflowAction($this, $secondFixture, $f['billing'], 'invoice')->assertRedirect();
    expect($second->documents()->sole()->number)->toBe('FACT-000002');
});

it('caps successive partial credits at the rounded invoiced amounts', function () {
    $f = workflowFixture();
    $cart = $f['cart'];
    $workflow = $cart->workflow;
    $workflow['lines'][0] = array_replace($workflow['lines'][0], [
        'quantity' => 3, 'ordered_quantity' => 3, 'unit_price' => 0.01, 'discount_rate' => 0.33, 'shipping' => 0,
    ]);
    $cart->workflow = $workflow;
    $cart->save();
    workflowAction($this, $f, $f['billing'], 'ship');
    workflowAction($this, $f, $f['billing'], 'deliver');
    workflowAction($this, $f, $f['billing'], 'invoice')->assertRedirect();
    for ($index = 0; $index < 3; $index++) {
        $this->actingAs($f['client'])->post('/orders/'.$cart->id.'/issues', [
            'revision' => $cart->fresh()->revision, 'product_id' => $f['product']->id,
            'kind' => 'damaged', 'quantity' => 1, 'comment' => 'Produit abîmé',
        ])->assertRedirect();
        $issue = $cart->issues()->latest('id')->first();
        $this->actingAs($f['billing'])->put('/orders/'.$cart->id.'/issues/'.$issue->id, [
            'revision' => $cart->fresh()->revision, 'status' => 'approved', 'resolution' => 'Validé',
        ])->assertRedirect();
        workflowAction($this, $f, $f['billing'], 'credit')->assertRedirect();
    }
    $invoice = $cart->documents()->where('kind', 'invoice')->sole();
    $credits = $cart->documents()->where('kind', 'credit')->get();
    expect($invoice->snapshot['total_ht'])->toEqual(0.02)
        ->and($credits->sum(fn ($doc) => $doc->snapshot['total_ht']))->toEqual($invoice->snapshot['total_ht'])
        ->and($credits->sum(fn ($doc) => $doc->snapshot['total_tva']))->toEqual($invoice->snapshot['total_tva']);
});
