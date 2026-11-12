<?php

return [
    'dir' => ['storage'],

    'disks' => [],

    'route' => [
        'prefix' => 'admin/media',
        'middleware' => ['web', 'auth', 'role:admin'],
    ],

    'access' => 'Barryvdh\Elfinder\Elfinder::checkAccess',

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
