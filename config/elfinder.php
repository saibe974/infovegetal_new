<?php

return [
    'dir' => ['storage'],

    'disks' => [],

    'route' => [
        'prefix' => 'elfinder',
        // Every authenticated user may open elFinder; the volumes they see are
        // restricted per user by ConfigureElfinderRoots (see App\Support\ElfinderRoots).
        'middleware' => ['web', 'auth', App\Http\Middleware\ConfigureElfinderRoots::class],
    ],

    'access' => 'Barryvdh\Elfinder\Elfinder::checkAccess',

    // Default (admin) volume; replaced per request by ConfigureElfinderRoots.
    'roots' => [
        [
            'driver' => 'LocalFileSystem',
            'path' => storage_path('app/public'),
            'URL' => env('APP_URL').'/storage',
            'alias' => 'Fichiers',
            'statCorrector' => [App\Support\ElfinderFolderLabel::class, 'apply'],
            'uploadDeny' => ['all'],
            'uploadAllow' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            'uploadOrder' => ['deny', 'allow'],
            'uploadMaxSize' => '10M',
            'disabled' => ['mkfile', 'edit', 'put', 'extract', 'archive', 'netmount'],
            'accessControl' => 'Barryvdh\Elfinder\Elfinder::checkAccess',
        ],
    ],

    'options' => [],

    'root_options' => [],
];
