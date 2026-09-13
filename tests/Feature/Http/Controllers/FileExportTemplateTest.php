<?php

use App\Models\User;
use App\Services\ProductExportService;

function libraryTemplatePayload(string $id = 'template-one'): array
{
    return ['id' => $id, 'format' => 'csv', 'template' => ProductExportService::options()['template']];
}

it('requires authentication for the personal library', function () {
    $this->getJson('/file-export-templates')->assertUnauthorized();
    $this->postJson('/file-export-templates', libraryTemplatePayload())->assertUnauthorized();
    $this->deleteJson('/file-export-templates/template-one')->assertUnauthorized();
});

it('stores, updates and duplicates definitions without coupling their contents', function () {
    $this->actingAs(User::factory()->withoutTwoFactor()->create());
    $original = libraryTemplatePayload();
    $this->postJson('/file-export-templates', $original)->assertOk();
    $copy = libraryTemplatePayload('template-copy');
    $copy['template']['name'] = 'Copie';
    $this->postJson('/file-export-templates', $copy)->assertOk();
    $original['template']['name'] = 'Modifié';
    $this->postJson('/file-export-templates', $original)->assertOk();
    $this->getJson('/file-export-templates')->assertOk()->assertJsonCount(2)
        ->assertJsonPath('0.template.name', 'Modifié')->assertJsonPath('1.template.name', 'Copie');
    $this->deleteJson('/file-export-templates/template-one')->assertNoContent();
    $this->getJson('/file-export-templates')->assertJsonCount(1)->assertJsonPath('0.id', 'template-copy');
});

it('isolates users even when they use the same client identifier', function () {
    $owner = User::factory()->withoutTwoFactor()->create();
    $other = User::factory()->withoutTwoFactor()->create();
    $this->actingAs($owner)->postJson('/file-export-templates', libraryTemplatePayload())->assertOk();
    $this->actingAs($other)->getJson('/file-export-templates')->assertExactJson([]);
    $copy = libraryTemplatePayload();
    $copy['template']['name'] = 'Other';
    $this->postJson('/file-export-templates', $copy)->assertOk();
    $this->deleteJson('/file-export-templates/template-one')->assertNoContent();
    $this->actingAs($owner)->getJson('/file-export-templates')->assertJsonCount(1)
        ->assertJsonPath('0.template.name', libraryTemplatePayload()['template']['name']);
});

it('preserves tab delimiters, literal whitespace and empty cells', function () {
    $this->actingAs(User::factory()->withoutTwoFactor()->create());
    $payload = libraryTemplatePayload();
    $payload['format'] = 'tsv';
    $payload['template']['delimiter'] = "\t";
    $payload['template']['blocks'][0]['rows'][0]['cells']['id'] = '  literal  ';
    $payload['template']['blocks'][0]['rows'][0]['cells']['sku'] = '';
    $this->postJson('/file-export-templates', $payload)->assertOk();
    $this->getJson('/file-export-templates')->assertJsonPath('0.template.delimiter', "\t")
        ->assertJsonPath('0.template.blocks.0.rows.0.cells.id', '  literal  ')
        ->assertJsonPath('0.template.blocks.0.rows.0.cells.sku', '');
});

it('rejects oversized definitions and business settings in the library', function () {
    $this->actingAs(User::factory()->withoutTwoFactor()->create());
    $payload = libraryTemplatePayload();
    $payload['template']['events'] = ['invoice'];
    $this->postJson('/file-export-templates', $payload)->assertUnprocessable()->assertJsonValidationErrors('template');
    $payload = libraryTemplatePayload();
    $payload['template']['blocks'][0]['rows'][0]['cells']['id'] = str_repeat('a', 1001);
    $this->postJson('/file-export-templates', $payload)->assertUnprocessable();
    $payload = libraryTemplatePayload();
    $payload['format'] = 'pdf';
    $this->postJson('/file-export-templates', $payload)->assertUnprocessable()->assertJsonValidationErrors('format');
    $this->getJson('/file-export-templates')->assertExactJson([]);
});

it('keeps billing variables in shared definitions for context-specific compatibility checks', function () {
    $this->actingAs(User::factory()->withoutTwoFactor()->create());
    $payload = libraryTemplatePayload('billing-invoice');
    $payload['template']['filename'] = 'invoice_%document.number%';
    $payload['template']['blocks'][0]['rows'][0]['cells']['id'] = '%quantity%';
    $this->postJson('/file-export-templates', $payload)->assertOk();
    $this->getJson('/file-export-templates')->assertJsonPath('0.template.filename', 'invoice_%document.number%');
});
