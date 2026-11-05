<?php

namespace App\Services;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class FileUploadService
{
    public function handleRegularUpload(Request $request): JsonResponse
    {
        abort_unless(Auth::check(), 401);
        $request->validate(['file' => ['required', 'file', 'max:'.intdiv(config('uploads.max_bytes'), 1024)]]);
        $uploaded = $request->file('file');
        $name = $uploaded->getClientOriginalName();
        $policy = app(ImportUploadPolicy::class);
        $mime = $policy->validateFile($uploaded->getRealPath(), $name, $uploaded->getSize());
        $path = $uploaded->storeAs('imports/'.Auth::id(), Str::uuid().'.'.$policy->validateName($name), 'local');
        abort_unless($path, 500);

        return $this->record($name, $path, $uploaded->getSize(), $mime);
    }

    public function record(string $name, string $path, int $size, string $mime): JsonResponse
    {
        abort_unless(Auth::check(), 401);
        $file = Auth::user()->files()->create([
            'file_name' => $name, 'file_path' => $path, 'file_size' => $size, 'disk' => 'local', 'mime' => $mime,
        ]);
        Cache::put('import:'.$file->id, [
            'status' => 'uploaded', 'path' => $path, 'disk' => 'local', 'owner_id' => Auth::id(),
            'original_name' => $name, 'size' => $size,
        ], now()->addHour());

        return response()->json(['id' => $file->id, 'uploadId' => (string) $file->id, 'file' => $name, 'path' => $path, 'size' => $size]);
    }
}
