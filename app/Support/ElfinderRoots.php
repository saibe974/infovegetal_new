<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\File;

/**
 * Builds the elFinder volumes visible to a given user.
 *
 * - admin: the whole public disk (unchanged behaviour).
 * - dev: the whole public disk + the whole private disk.
 * - anyone else: only their own user-meta/{id} folders (private + public),
 *   read-only unless granted media.upload / media.rename / media.delete.
 */
class ElfinderRoots
{
    public const PERMISSIONS = ['media.upload', 'media.rename', 'media.delete'];

    /** Commands never available to a restricted user (moving/copying across folders, archives...). */
    private const USER_ALWAYS_DISABLED = [
        'mkfile', 'edit', 'put', 'extract', 'archive', 'netmount',
        'copy', 'cut', 'paste', 'duplicate', 'resize', 'chmod',
    ];

    public static function forUser(User $user): array
    {
        $isAdmin = $user->hasRole('admin');
        $isDev = $user->hasRole('dev');

        if ($isAdmin || $isDev) {
            $roots = [self::publicRoot()];
            if ($isDev) {
                $roots[] = self::privateRoot();
            }

            return $roots;
        }

        return self::userRoots($user);
    }

    /** Full public disk root, as configured historically for admins. */
    public static function publicRoot(): array
    {
        return [
            'driver' => 'LocalFileSystem',
            'path' => storage_path('app/public'),
            'URL' => env('APP_URL').'/storage',
            'alias' => 'Fichiers',
            'statCorrector' => [ElfinderFolderLabel::class, 'apply'],
            ...self::uploadRules(),
            'disabled' => ['mkfile', 'edit', 'put', 'extract', 'archive', 'netmount'],
            'accessControl' => 'Barryvdh\Elfinder\Elfinder::checkAccess',
        ];
    }

    /** Full private disk root (dev only). No URL: files are streamed through the connector. */
    public static function privateRoot(): array
    {
        return [
            'driver' => 'LocalFileSystem',
            'path' => storage_path('app/private'),
            'URL' => '',
            'tmbPath' => '',
            'alias' => 'Privé',
            'statCorrector' => [ElfinderPrivateFolderLabel::class, 'apply'],
            ...self::uploadRules(),
            'disabled' => ['mkfile', 'edit', 'put', 'extract', 'archive', 'netmount'],
            'accessControl' => 'Barryvdh\Elfinder\Elfinder::checkAccess',
        ];
    }

    private static function userRoots(User $user): array
    {
        $disabled = self::USER_ALWAYS_DISABLED;
        if (! $user->can('media.upload')) {
            array_push($disabled, 'upload', 'mkdir');
        }
        if (! $user->can('media.rename')) {
            $disabled[] = 'rename';
        }
        if (! $user->can('media.delete')) {
            array_push($disabled, 'rm', 'empty');
        }

        $base = [
            'driver' => 'LocalFileSystem',
            // Served through the authenticated connector only, never via a public URL.
            'URL' => '',
            'tmbPath' => '',
            ...self::uploadRules(),
            'disabled' => array_values(array_unique($disabled)),
            'accessControl' => 'Barryvdh\Elfinder\Elfinder::checkAccess',
        ];

        $id = (int) $user->id;
        $volumes = [
            ['path' => storage_path("app/private/user-meta/{$id}"), 'alias' => 'Mes documents', 'id' => 'up'.$id],
            ['path' => storage_path("app/public/user-meta/{$id}"), 'alias' => 'Mes médias', 'id' => 'um'.$id],
        ];

        $roots = [];
        foreach ($volumes as $volume) {
            File::ensureDirectoryExists($volume['path']);
            $roots[] = [...$base, ...$volume];
        }

        return $roots;
    }

    private static function uploadRules(): array
    {
        return [
            'uploadDeny' => ['all'],
            'uploadAllow' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            'uploadOrder' => ['deny', 'allow'],
            'uploadMaxSize' => '10M',
        ];
    }
}
