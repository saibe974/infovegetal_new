<?php

use App\Models\User;
use App\Support\ElfinderUserFolderLabel;

test('user folder labels follow profile names without changing physical names', function () {
    $user = User::factory()->create(['name' => 'Jean Dupont']);
    $path = storage_path('app/public/user-meta/'.$user->id);
    $stat = ['mime' => 'directory', 'name' => (string) $user->id, 'hash' => 'unchanged'];

    call_user_func_array(config('elfinder.roots.0.statCorrector'), [&$stat, $path, false, null]);

    expect($stat)->toBe([
        'mime' => 'directory', 'name' => (string) $user->id,
        'hash' => 'unchanged', 'i18' => 'Jean Dupont',
    ]);

    $user->update(['name' => 'Jean Martin']);
    ElfinderUserFolderLabel::apply($stat, $path);

    expect($stat['i18'])->toBe('Jean Martin');
});

test('other paths and missing users keep their original labels', function () {
    $user = User::factory()->create();

    foreach ([
        storage_path('app/public/products/'.$user->id),
        storage_path('app/public/user-meta/'.$user->id.'/commandes'),
        storage_path('app/private/user-meta/'.$user->id),
        storage_path('app/public/user-meta/not-a-user'),
        storage_path('app/public/user-meta/999999999'),
    ] as $path) {
        $stat = ['mime' => 'directory', 'name' => basename($path)];
        $original = $stat;
        ElfinderUserFolderLabel::apply($stat, $path);
        expect($stat)->toBe($original);
    }

    $stat = ['mime' => 'image/png', 'name' => (string) $user->id];
    ElfinderUserFolderLabel::apply($stat, storage_path('app/public/user-meta/'.$user->id));
    expect($stat)->not->toHaveKey('i18');
});
