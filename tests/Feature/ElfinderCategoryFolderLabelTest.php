<?php

use App\Models\CategoryProducts;
use App\Support\ElfinderFolderLabel;

test('product folder labels follow category names while preserving paths and hashes', function () {
    $category = CategoryProducts::create(['name' => 'Arbres']);
    $path = storage_path('app/public/products/'.$category->id);
    $stat = ['mime' => 'directory', 'name' => (string) $category->id, 'hash' => 'unchanged'];

    call_user_func_array(config('elfinder.roots.0.statCorrector'), [&$stat, $path, false, null]);

    expect($stat)->toBe([
        'mime' => 'directory', 'name' => (string) $category->id,
        'hash' => 'unchanged', 'i18' => 'Arbres',
    ]);

    $category->update(['name' => 'Arbres fruitiers']);
    ElfinderFolderLabel::apply($stat, $path);
    expect($stat['i18'])->toBe('Arbres fruitiers');
});

test('category labels only affect existing categories in immediate product directories', function () {
    $category = CategoryProducts::create(['name' => 'Arbres']);

    foreach ([
        storage_path('app/public/products/'.$category->id.'/conversions'),
        storage_path('app/private/products/'.$category->id),
        storage_path('app/public/products/uncategorized'),
        storage_path('app/public/products/999999999'),
    ] as $path) {
        $stat = ['mime' => 'directory', 'name' => basename($path)];
        $original = $stat;
        ElfinderFolderLabel::apply($stat, $path);
        expect($stat)->toBe($original);
    }

    $stat = ['mime' => 'image/png', 'name' => (string) $category->id];
    ElfinderFolderLabel::apply($stat, storage_path('app/public/products/'.$category->id));
    expect($stat)->not->toHaveKey('i18');
});
