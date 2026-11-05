<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
    Storage::fake('public');
});

test('uploads require authentication and reject scripts disguised as imports', function () {
    $this->postJson('/upload')->assertUnauthorized();
    $this->actingAs(User::factory()->withoutTwoFactor()->create());
    foreach (['shell.php', 'shell.php.csv', 'shell.csv'] as $name) {
        $this->postJson('/upload', ['file' => UploadedFile::fake()->createWithContent($name, '<?php echo 1;')])->assertUnprocessable();
    }
    expect(Storage::disk('public')->allFiles())->toBeEmpty()->and(Storage::disk('local')->allFiles())->toBeEmpty();
});

test('valid imports stay private and enforce the configured limit', function () {
    $user = User::factory()->withoutTwoFactor()->create();
    $this->actingAs($user);
    $response = $this->postJson('/upload', ['file' => UploadedFile::fake()->createWithContent('products.csv', "sku;name\n1;Rose\n")])->assertOk();
    expect($user->files()->first()->disk)->toBe('local');
    Storage::disk('local')->assertExists($response->json('path'));
    expect(Storage::disk('public')->allFiles())->toBeEmpty();
    config(['uploads.max_bytes' => 1024]);
    $this->postJson('/upload', ['file' => UploadedFile::fake()->create('large.csv', 2)])->assertUnprocessable();
});

test('chunk operations reject another owner and malformed identifiers', function () {
    $owner = User::factory()->withoutTwoFactor()->create();
    $other = User::factory()->withoutTwoFactor()->create();
    $this->actingAs($owner);
    $start = $this->postJson('/upload', [], ['Upload-Length' => '12', 'Upload-Name' => 'products.csv'])->assertOk();
    $id = $start->json('uploadId');
    $this->actingAs($other);
    $this->patchJson('/upload', [], ['Upload-Id' => $id, 'Upload-Offset' => '0'])->assertForbidden();
    $this->deleteJson('/upload', [], ['Upload-Id' => $id])->assertForbidden();
    $this->postJson('/upload', [], ['Upload-Id' => $id, 'Upload-Length' => '12'])->assertForbidden();
    $this->patchJson('/upload', [], ['Upload-Id' => '../outside', 'Upload-Offset' => '0'])->assertUnprocessable();
    $this->actingAs($owner)->deleteJson('/upload', [], ['Upload-Id' => $id])->assertOk();
    Storage::disk('local')->assertMissing('imports/chunks/'.$id.'/meta.json');
});

test('chunks reject excessive totals, out of order data and script content', function () {
    $this->actingAs(User::factory()->withoutTwoFactor()->create());
    $this->postJson('/upload', [], ['Upload-Length' => (string) (config('uploads.max_bytes') + 1)])->assertUnprocessable();
    $start = $this->postJson('/upload', [], ['Upload-Length' => '13', 'Upload-Name' => 'products.csv'])->assertOk();
    $id = $start->json('uploadId');
    $this->call('PATCH', '/upload?patch='.$id, server: ['HTTP_ACCEPT' => 'application/json', 'HTTP_UPLOAD_OFFSET' => '1'], content: 'abc')->assertConflict();
    $this->call('PATCH', '/upload?patch='.$id, server: ['HTTP_ACCEPT' => 'application/json', 'HTTP_UPLOAD_OFFSET' => '0'], content: '<?php echo 1;')->assertUnprocessable();
    expect(Storage::disk('local')->allFiles())->toBeEmpty();
});

test('an administrator cannot process or read another upload by guessing its file id', function () {
    $owner = User::factory()->withoutTwoFactor()->create();
    $admin = User::factory()->withoutTwoFactor()->create();
    $admin->assignRole(\Spatie\Permission\Models\Role::findOrCreate('admin', 'web'));
    $file = $owner->files()->create(['file_name' => 'products.csv', 'file_path' => 'imports/owner.csv', 'file_size' => 10, 'disk' => 'local']);
    $this->actingAs($admin)->postJson('/admin/products/import/process', ['id' => (string) $file->id])->assertNotFound();
    $this->getJson('/admin/products/import/progress/'.$file->id)->assertNotFound();
    $this->getJson('/admin/users/import/report/'.$file->id)->assertNotFound();
});

test('FilePond can initialize without a name and finish through its patch query identifier', function () {
    $user = User::factory()->withoutTwoFactor()->create();
    $this->actingAs($user);
    $contents = "sku;name\n1;Rose\n";
    $id = $this->postJson('/upload', [], ['Upload-Length' => (string) strlen($contents)])->assertOk()->json('uploadId');
    $headers = ['HTTP_ACCEPT' => 'application/json', 'HTTP_UPLOAD_OFFSET' => '0', 'HTTP_UPLOAD_NAME' => 'products.csv'];
    $response = $this->call('PATCH', '/upload?patch='.$id, server: $headers, content: $contents)->assertOk();
    $file = $user->files()->firstOrFail();
    expect($response->json('uploadId'))->toBe((string) $file->id)
        ->and($file->disk)->toBe('local')
        ->and(Storage::disk('local')->get($file->file_path))->toBe($contents);
    $this->call('PATCH', '/upload?patch='.$id, server: $headers, content: $contents)->assertOk()->assertJson(['id' => $file->id]);
    expect($user->files()->count())->toBe(1);
});
