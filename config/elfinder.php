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
            'path' => storage_path('app/public/media'),
            'URL' => env('APP_URL') . '/storage/media',
            'alias' => 'Media',
            'accessControl' => 'Barryvdh\Elfinder\Elfinder::checkAccess',
        ],
    ],

    'options' => [],

    'root_options' => [],
];
