<?php

use App\Models\Cart;
use App\Models\File;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

test('admins can preview client order PDFs while unrelated clients cannot', function () {
    Storage::fake('public');
    $admin = User::factory()->withoutTwoFactor()->create();
    $admin->assignRole(Role::findOrCreate('admin', 'web'));
    $client = User::factory()->withoutTwoFactor()->create();
    $other = User::factory()->withoutTwoFactor()->create();
    $cart = Cart::create(['user_id' => $client->id, 'status' => 'processed']);
    $path = 'user-meta/'.$client->id.'/commandes/test.pdf';
    Storage::disk('public')->put($path, '%PDF-test');
    $file = File::create([
        'user_id' => $client->id, 'cart_id' => $cart->id, 'disk' => 'public',
        'file_path' => $path, 'file_name' => 'test.pdf', 'file_size' => 9,
        'mime' => 'application/pdf', 'document_key' => 'order-pdf',
    ]);

    $this->actingAs($admin)->get('/order-files/cart/'.$cart->id.'/pdf')->assertOk()->assertStreamedContent('%PDF-test');
    $this->actingAs($other)->get('/order-files/cart/'.$cart->id.'/pdf')->assertNotFound();
    $this->actingAs($other)->get('/order-files/'.$file->id.'/preview')->assertNotFound();
});

test('ajax impersonation returns the renewed token for the next request', function () {
    $admin = User::factory()->withoutTwoFactor()->create();
    $admin->assignRole(Role::findOrCreate('admin', 'web'));
    $client = User::factory()->withoutTwoFactor()->create();

    $response = $this->actingAs($admin)->withSession(['_token' => 'previous-token'])
        ->getJson('/impersonate/take/'.$client->id, ['X-Requested-With' => 'XMLHttpRequest']);

    $response->assertOk()->assertJsonStructure(['csrf_token']);
    expect($response->json('csrf_token'))->not->toBe('previous-token');
    $response->assertSessionHas('_token', $response->json('csrf_token'));
});
