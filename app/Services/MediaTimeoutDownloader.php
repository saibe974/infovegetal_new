<?php

namespace App\Services;

use Spatie\MediaLibrary\Downloaders\Downloader;
use Spatie\MediaLibrary\MediaCollections\Exceptions\UnreachableUrl;

class MediaTimeoutDownloader implements Downloader
{
    public function getTempFile(string $url): string
    {
        $timeout = (int) config('media-library.media_downloader_timeout', 12);
        if ($timeout < 1) {
            $timeout = 12;
        }

        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => config('media-library.media_downloader_ssl'),
                'verify_peer_name' => config('media-library.media_downloader_ssl'),
            ],
            'http' => [
                'header' => 'User-Agent: Spatie MediaLibrary',
                'timeout' => $timeout,
            ],
        ]);

        $stream = @fopen($url, 'r', false, $context);
        if (! $stream) {
            throw UnreachableUrl::create($url);
        }

        $temporaryFile = tempnam(sys_get_temp_dir(), 'media-library');
        $out = fopen($temporaryFile, 'w');

        if (! $out) {
            fclose($stream);
            throw UnreachableUrl::create($url);
        }

        stream_copy_to_stream($stream, $out);
        $meta = stream_get_meta_data($stream);

        fclose($out);
        fclose($stream);

        if (!empty($meta['timed_out'])) {
            @unlink($temporaryFile);
            throw UnreachableUrl::create($url);
        }

        return $temporaryFile;
    }
}
