<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('profile page is displayed', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('profile.edit'));

    $response->assertOk();
});

test('profile information can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    $user->refresh();

    expect($user->name)->toBe('Test User');
    expect($user->email)->toBe('test@example.com');
    expect($user->email_verified_at)->toBeNull();
});

test('email verification status is unchanged when the email address is unchanged', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => $user->email,
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

test('dynamic fields are synchronized with the complete profile form', function () {
    $user = User::factory()->create();
    $kept = $user->usersMeta()->create([
        'key' => 'phone.secondary',
        'value' => 'old value',
        'type' => 'input',
        'sort_order' => 0,
    ]);
    $removed = $user->usersMeta()->create([
        'key' => 'obsolete',
        'value' => 'remove me',
        'type' => 'input',
        'sort_order' => 1,
    ]);
    $logo = $user->usersMeta()->create([
        'key' => 'logo',
        'value' => '{"url":"/logo.png"}',
        'type' => 'file/image',
        'sort_order' => 0,
    ]);

    $response = $this
        ->actingAs($user)
        ->post(route('profile.update'), [
            '_method' => 'patch',
            'name' => $user->name,
            'email' => $user->email,
            'sync_metas' => true,
            'metas' => [
                [
                    'id' => $kept->id,
                    'key' => 'phone.secondary',
                    'title' => 'Téléphone secondaire',
                    'value' => 'new value',
                    'value_json' => [],
                    'type' => 'input',
                    'sort_order' => 0,
                ],
                [
                    'id' => -1,
                    'key' => 'new.field',
                    'title' => 'Nouveau champ',
                    'value' => 'created value',
                    'value_json' => [],
                    'type' => 'input',
                    'sort_order' => 1,
                ],
            ],
        ]);

    $response->assertSessionHasNoErrors();

    $this->assertDatabaseHas('users_meta', [
        'id' => $kept->id,
        'user_id' => $user->id,
        'title' => 'Téléphone secondaire',
        'value' => 'new value',
    ]);
    $this->assertDatabaseMissing('users_meta', ['id' => $removed->id]);
    $this->assertDatabaseHas('users_meta', [
        'user_id' => $user->id,
        'key' => 'new.field',
        'title' => 'Nouveau champ',
        'value' => 'created value',
    ]);
    $this->assertDatabaseHas('users_meta', ['id' => $logo->id]);
});

test('an empty dynamic fields list removes every non logo field', function () {
    $user = User::factory()->create();
    $meta = $user->usersMeta()->create([
        'key' => 'obsolete',
        'value' => 'remove me',
        'type' => 'input',
        'sort_order' => 0,
    ]);

    $response = $this
        ->actingAs($user)
        ->post(route('profile.update'), [
            '_method' => 'patch',
            'name' => $user->name,
            'email' => $user->email,
            'sync_metas' => true,
        ]);

    $response->assertSessionHasNoErrors();
    $this->assertDatabaseMissing('users_meta', ['id' => $meta->id]);
});

test('sales conditions are uploaded as a PDF with the complete profile form', function () {
    Storage::fake('public');

    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->post(route('profile.update'), [
            '_method' => 'patch',
            'name' => $user->name,
            'email' => $user->email,
            'sync_metas' => true,
            'metas' => [
                [
                    'id' => -1,
                    'key' => 'sales_conditions',
                    'title' => 'Conditions de vente',
                    'value' => '',
                    'value_json' => [],
                    'value_file' => UploadedFile::fake()->createWithContent(
                        'document.pdf',
                        "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF",
                    ),
                    'type' => 'file/pdf',
                    'sort_order' => 0,
                ],
            ],
        ]);

    $response->assertSessionHasNoErrors();

    $meta = $user->usersMeta()->where('key', 'sales_conditions')->firstOrFail();
    $stored = json_decode($meta->value, true);

    expect($meta->type)->toBe('file/pdf');
    expect($meta->title)->toBe('Conditions de vente');
    expect($stored['file_name'])->toBe('document.pdf');
    expect($stored['mime_type'])->toBe('application/pdf');
    $this->assertDatabaseHas('media', [
        'id' => $stored['media_id'],
        'model_id' => $user->id,
        'mime_type' => 'application/pdf',
    ]);
});

test('user can delete their account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
});

test('correct password must be provided to delete account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), [
            'password' => 'wrong-password',
        ]);

    $response
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('profile.edit'));

    expect($user->fresh())->not->toBeNull();
});
