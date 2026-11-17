<?php

namespace App\Support;

class ElfinderPrivateFolderLabel
{
    public static function apply(array &$stat, string $path): void
    {
        ElfinderUserFolderLabel::apply($stat, $path, storage_path('app/private'));
    }
}
