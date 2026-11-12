<?php

namespace App\Support;

use App\Models\CategoryProducts;

class ElfinderFolderLabel
{
    public static function apply(array &$stat, string $path): void
    {
        ElfinderUserFolderLabel::apply($stat, $path);

        $path = str_replace('\\', '/', $path);
        $root = rtrim(str_replace('\\', '/', storage_path('app/public')), '/');

        if (($stat['mime'] ?? null) !== 'directory'
            || ! str_starts_with($path, $root.'/products/')) {
            return;
        }

        $id = substr($path, strlen($root.'/products/'));

        if (! ctype_digit($id)) {
            return;
        }

        // Resolve the current category name without changing physical paths.
        $name = CategoryProducts::query()->whereKey($id)->value('name');

        if (is_string($name) && trim($name) !== '') {
            $stat['i18'] = $name;
        }
    }
}
