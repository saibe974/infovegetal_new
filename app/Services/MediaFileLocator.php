<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaFileLocator
{
    private const CACHE_KEY = 'media-file-locator:index:v1';

    private const CACHE_TTL = 21600;

    private ?array $index = null;

    public function __construct(
        private readonly ?string $disk = null,
        private readonly string $scanDir = 'products',
    ) {}

    public function locateByBaseName(string $baseName, ?string $preferredFileName = null): ?string
    {
        $slug = Str::slug($baseName);
        if ($slug === '') {
            return null;
        }

        $candidates = $this->index()[$slug] ?? null;
        if ($candidates === null) {
            return null;
        }

        if ($preferredFileName !== null) {
            $preferred = mb_strtolower($preferredFileName);
            foreach ($candidates as $path) {
                if (mb_strtolower(basename($path)) === $preferred) {
                    return $path;
                }
            }
        }

        return $candidates[0];
    }

    public function relocateIndexEntry(string $from, string $to): void
    {
        $slugFrom = Str::slug(pathinfo($from, PATHINFO_FILENAME));
        if ($slugFrom === '') {
            return;
        }

        $index = $this->index();
        $entries = array_values(array_diff($index[$slugFrom] ?? [], [$from]));
        if ($entries === []) {
            unset($index[$slugFrom]);
        } else {
            $index[$slugFrom] = $entries;
        }

        $slugTo = Str::slug(pathinfo($to, PATHINFO_FILENAME));
        if ($slugTo !== '') {
            $index[$slugTo][] = $to;
        }

        Cache::put(self::CACHE_KEY, $index, self::CACHE_TTL);
        $this->index = $index;
    }

    private function index(): array
    {
        if ($this->index === null) {
            $this->index = Cache::remember(
                self::CACHE_KEY,
                self::CACHE_TTL,
                fn () => $this->buildIndex(),
            );
        }

        return $this->index;
    }

    private function buildIndex(): array
    {
        $index = [];
        $disk = $this->disk ?: (string) config('media-library.disk_name', 'public');

        try {
            $files = Storage::disk($disk)->allFiles($this->scanDir);
        } catch (\Throwable) {
            return $index;
        }

        foreach ($files as $path) {
            $path = str_replace('\\', '/', (string) $path);
            $segments = explode('/', $path);
            if (in_array('conversions', $segments, true)) {
                continue;
            }

            $slug = Str::slug(pathinfo($path, PATHINFO_FILENAME));
            if ($slug === '') {
                continue;
            }

            $index[$slug][] = $path;
        }

        return $index;
    }
}
