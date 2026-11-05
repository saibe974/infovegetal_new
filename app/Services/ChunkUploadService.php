<?php

namespace App\Services;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ChunkUploadService
{
    public function handleChunkUpload(Request $request): JsonResponse
    {
        abort_unless(Auth::check(), 401);
        $id = $request->header('Upload-Id') ?? $request->query('patch');
        if ($request->isMethod('delete')) {
            $id ??= $request->getContent();
        }
        if ($id === null && $request->isMethod('post')) {
            $id = (string) Str::uuid();
        }
        if (! is_string($id) || ! preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9_-]{15,79}\z/', $id)) {
            throw ValidationException::withMessages(['upload' => 'Identifiant invalide.']);
        }

        return Cache::lock('upload:'.$id, 30)->block(5, function () use ($request, $id) {
            $disk = Storage::disk('local');
            $directory = 'imports/chunks/'.$id;
            $metaPath = $directory.'/meta.json';
            $meta = $disk->exists($metaPath) ? json_decode($disk->get($metaPath), true, flags: JSON_THROW_ON_ERROR) : null;
            if ($meta) {
                abort_unless((int) $meta['owner'] === (int) Auth::id(), 403);
                abort_if(($meta['expires_at'] ?? 0) < time(), 410, 'Upload expiré.');
            } else {
                abort_unless($request->isMethod('post'), 404);
                $length = $request->header('Upload-Length');
                if (! is_string($length) || ! ctype_digit($length) || (int) $length < 1 || (int) $length > config('uploads.max_bytes')) {
                    throw ValidationException::withMessages(['upload' => 'Taille invalide.']);
                }
                $meta = ['owner' => Auth::id(), 'length' => (int) $length, 'offset' => 0, 'name' => null, 'expires_at' => time() + 3600];
            }
            if ($request->isMethod('delete')) {
                if (isset($meta['completed'])) {
                    abort(409, 'Upload terminé.');
                }
                $disk->deleteDirectory($directory);

                return response()->json(['status' => 'deleted']);
            }
            if (isset($meta['completed'])) {
                return response()->json($meta['completed']);
            }
            $name = $request->header('Upload-Name');
            if ($name !== null) {
                app(ImportUploadPolicy::class)->validateName($name);
                if ($meta['name'] !== null && $meta['name'] !== $name) {
                    abort(409, 'Nom modifié.');
                }
                $meta['name'] = $name;
            }
            if ($request->hasHeader('Upload-Length') && (string) $meta['length'] !== $request->header('Upload-Length')) {
                abort(409, 'Taille modifiée.');
            }
            if ($request->hasHeader('Upload-Offset')) {
                $offset = $request->header('Upload-Offset');
                if (! is_string($offset) || ! ctype_digit($offset)) {
                    throw ValidationException::withMessages(['upload' => 'Position invalide.']);
                }
                abort_if((int) $request->header('Content-Length', 0) > config('uploads.chunk_max_bytes'), 413);
                $body = $request->getContent();
                $size = strlen($body);
                if ($size < 1 || $size > config('uploads.chunk_max_bytes') || (int) $offset + $size > $meta['length']) {
                    throw ValidationException::withMessages(['upload' => 'Morceau trop volumineux ou vide.']);
                }
                $part = $directory.'/chunk_'.$offset;
                if ((int) $offset !== $meta['offset']) {
                    abort_unless((int) $offset < $meta['offset'] && $disk->exists($part) && hash_equals(hash('sha256', $disk->get($part)), hash('sha256', $body)), 409);
                } else {
                    abort_unless($disk->put($part, $body), 500);
                    $meta['offset'] += $size;
                }
            } elseif (! $request->isMethod('post')) {
                throw ValidationException::withMessages(['upload' => 'Position requise.']);
            }
            abort_unless($disk->put($metaPath, json_encode($meta, JSON_THROW_ON_ERROR)), 500);
            if ($meta['offset'] === $meta['length']) {
                if ($meta['name'] === null) {
                    throw ValidationException::withMessages(['upload' => 'Nom requis.']);
                }
                $extension = app(ImportUploadPolicy::class)->validateName($meta['name']);
                $path = 'imports/'.Auth::id().'/'.$id.'.'.$extension;
                $stream = tmpfile();
                if ($stream === false) {
                    throw new \RuntimeException('Temporary stream unavailable.');
                }
                try {
                    $parts = array_filter($disk->files($directory), fn ($p) => str_contains(basename($p), 'chunk_'));
                    usort($parts, fn ($a, $b) => (int) substr(basename($a), 6) <=> (int) substr(basename($b), 6));
                    foreach ($parts as $part) {
                        $input = $disk->readStream($part);
                        try {
                            if (stream_copy_to_stream($input, $stream) === false) {
                                throw new \RuntimeException('Unable to assemble upload.');
                            }
                        } finally {
                            fclose($input);
                        }
                    }
                    $mime = app(ImportUploadPolicy::class)->validateFile(stream_get_meta_data($stream)['uri'], $meta['name'], $meta['length']);
                    rewind($stream);
                    abort_unless($disk->put($path, $stream), 500);
                } catch (\Throwable $e) {
                    $disk->deleteDirectory($directory);
                    throw $e;
                } finally {
                    fclose($stream);
                }
                $response = app(FileUploadService::class)->record($meta['name'], $path, $meta['length'], $mime);
                $disk->deleteDirectory($directory);
                // Keep a short lived owner-bound receipt for retries after a lost final response.
                $disk->put($metaPath, json_encode($meta + ['completed' => $response->getData(true)], JSON_THROW_ON_ERROR));

                return $response;
            }

            return response()->json(['status' => 'chunk_received', 'uploadId' => $id, 'offset' => $meta['offset'], 'currentSize' => $meta['offset'], 'uploadLength' => $meta['length']])->header('Upload-Id', $id);
        });
    }
}
