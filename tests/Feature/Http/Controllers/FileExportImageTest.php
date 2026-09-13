<?php

use App\Models\User;
use App\Services\OrderCsvService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;

function imageLibraryTemplatePayload(string $id): array
{
    return ['id' => $id, 'format' => 'xlsx', 'template' => \App\Services\ProductExportService::options()['template']];
}

beforeEach(function () {
    Storage::fake('public');
    config(['media-library.disk_name' => 'public']);
});

it('uploads document images to the authenticated user library with conversions', function () {
    $user = User::factory()->withoutTwoFactor()->create();
    $other = User::factory()->withoutTwoFactor()->create();

    $image = $this->actingAs($user)->post('/file-export-images', [
        'image' => UploadedFile::fake()->image('logo.png', 300, 200),
    ])->assertCreated()->json();

    expect($image['id'])->toBeInt()
        ->and($image['thumb_url'])->toContain('conversions')
        ->and($image['document_url'])->toContain('conversions');
    $this->getJson('/file-export-images')->assertJsonCount(1)->assertJsonPath('0.id', $image['id']);
    $this->actingAs($other)->getJson('/file-export-images')->assertExactJson([]);
    $this->get('/file-export-images/'.$image['id'])->assertNotFound();
});

it('embeds a fixed user image in a billing XLSX cell', function () {
    $user = User::factory()->withoutTwoFactor()->create();
    $imageId = $this->actingAs($user)->post('/file-export-images', [
        'image' => UploadedFile::fake()->image('logo.png', 300, 200),
    ])->assertCreated()->json('id');
    $template = [
        'delimiter' => ';',
        'blocks' => [[
            'id' => 'header', 'name' => 'Entête', 'type' => 'header',
            'enabled' => true, 'show_headers' => false,
            'columns' => [['id' => 'logo', 'name' => 'Logo']],
            'rows' => [['id' => 'logo', 'cells' => ['logo' => "%image:user:{$imageId}%"]]],
        ]],
    ];
    $binary = (new OrderCsvService)->renderXlsx($template, collect(), []);
    $path = tempnam(sys_get_temp_dir(), 'fixed-image-xlsx-');
    file_put_contents($path, $binary);

    try {
        $drawings = IOFactory::load($path)->getActiveSheet()->getDrawingCollection();
        expect($drawings)->toHaveCount(1)
            ->and($drawings[0]->getCoordinates())->toBe('A1');
    } finally {
        @unlink($path);
    }
});

it('rejects a saved template referencing another user image', function () {
    $owner = User::factory()->withoutTwoFactor()->create();
    $other = User::factory()->withoutTwoFactor()->create();
    $imageId = $this->actingAs($owner)->post('/file-export-images', [
        'image' => UploadedFile::fake()->image('private.png'),
    ])->assertCreated()->json('id');
    $payload = imageLibraryTemplatePayload('private-image');
    $payload['template']['blocks'][0]['rows'][0]['cells']['id'] = "%image:user:{$imageId}%";

    $this->actingAs($other)->postJson('/file-export-templates', $payload)
        ->assertUnprocessable()->assertJsonValidationErrors('template');
});
