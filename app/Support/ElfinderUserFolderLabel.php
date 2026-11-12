<?php

namespace App\Support;

use App\Models\User;

class ElfinderUserFolderLabel
{
    public static function apply(array &$stat, string $path): void
    {
        $path = str_replace('\\', '/', $path);
        $root = rtrim(str_replace('\\', '/', storage_path('app/public')), '/');

        // Only label immediate user directories; keep names and hashes intact.
        if (($stat['mime'] ?? null) !== 'directory'
            || ! str_starts_with($path, $root.'/user-meta/')) {
            return;
        }

        $id = substr($path, strlen($root.'/user-meta/'));

        if (! ctype_digit($id)) {
            return;
        }

        $name = User::query()->whereKey($id)->value('name');

        if (is_string($name) && trim($name) !== '') {
            $stat['i18'] = $name;
        }
    }
}
