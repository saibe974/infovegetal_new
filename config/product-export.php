<?php

return [
    // Synchronous exports: tune these limits to the hosting request timeout.
    'csv_max_rows' => 100000,
    'xlsx_max_rows' => 5000,
    'xlsx_image_max_rows' => 500,
    'chunk_size' => 200,
    'thumbnail_max_bytes' => 512 * 1024,
];
