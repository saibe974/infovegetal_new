<?php

namespace App\Services;

use App\Models\File;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\UnableToWriteFile;

class ChunkUploadService
{
    public function __construct(
        private Filesystem $disk
    ) {
        $this->disk = Storage::disk('local');
    }

    public function handleChunkUpload(Request $request): JsonResponse
    {
        $uploadOffset = (int) $request->header('Upload-Offset', 0);
        $uploadLength = (int) $request->header('Upload-Length');
        $uploadName = $request->header('Upload-Name');
        $uploadId = $request->header('Upload-Id', session()->getId());

        // Create temp path for chunks
        $tempPath = "chunks/{$uploadId}";

        // Ensure chunks directory exists
        $this->disk->makeDirectory($tempPath);

        $metaPath = "{$tempPath}/.upload-meta";

        // FilePond n'envoie Upload-Name/Upload-Length sur toutes les requêtes de chunks
        // (le premier POST de transfert n'inclut que Upload-Length). On les persiste
        // dès qu'ils sont fournis pour les réutiliser lors de l'assemblage.
        $meta = $this->readUploadMeta($tempPath, $metaPath);
        $uploadName = $uploadName ?? ($meta['uploadName'] ?? null);
        $uploadLength = $uploadLength > 0 ? $uploadLength : (int) ($meta['uploadLength'] ?? 0);

        if ($uploadName !== null && $uploadLength > 0) {
            $this->writeUploadMeta($tempPath, $metaPath, $uploadName, $uploadLength);
        }

        // Get chunk content
        $chunkContent = $request->getContent();
        $chunkSize = strlen($chunkContent);

        // Ne sauvegarder que les vrais chunks (présence de l'en-tête Upload-Offset,
        // envoyé par FilePond sur PATCH). Le premier POST de transfert transporte
        // uniquement des métadonnées et ne doit pas compter dans la taille assemblée.
        $hasOffsetHeader = $request->hasHeader('Upload-Offset');

        if ($chunkSize > 0 && $hasOffsetHeader) {
            // Save this chunk using Laravel Storage
            $chunkPath = "{$tempPath}/chunk_{$uploadOffset}";
            $this->disk->put($chunkPath, $chunkContent);
        }

        // Check if all chunks are received
        $currentSize = $this->getTotalChunksSize($tempPath);

        if ($currentSize >= $uploadLength) {
            if ($uploadName === null || $uploadLength <= 0) {
                $meta = $this->readUploadMeta($tempPath, $metaPath);
                $uploadName = $uploadName ?: ($meta['uploadName'] ?? null);
                $uploadLength = $uploadLength > 0 ? $uploadLength : (int) ($meta['uploadLength'] ?? 0);
            }

            if ($uploadName === null) {
                $uploadName = 'upload_'.$uploadId.'.csv';
            }

            // All chunks received, assemble the file
            return $this->assembleChunks($tempPath, $uploadName, $uploadLength, $uploadId);
        }

        // Clean up empty chunks
        // $this->cleanupEmptyChunks($tempPath, $chunkSize);

        // Return progress
        return response()
            ->json([
                'status' => 'chunk_received',
                'uploadId' => $uploadId,
                'offset' => $currentSize,
                'currentSize' => $currentSize,
                'uploadLength' => $uploadLength,
            ])
            ->header('Upload-Id', $uploadId);
    }

    private function writeUploadMeta(string $tempPath, string $metaPath, string $uploadName, int $uploadLength): void
    {
        $this->disk->put($metaPath, json_encode([
            'uploadName' => $uploadName,
            'uploadLength' => $uploadLength,
        ]));
    }

    private function readUploadMeta(string $tempPath, string $metaPath): array
    {
        if (! $this->disk->exists($metaPath)) {
            return [];
        }

        try {
            $meta = json_decode($this->disk->get($metaPath), true);

            return is_array($meta) ? $meta : [];
        } catch (\Throwable) {
            return [];
        }
    }

    private function getTotalChunksSize(string $tempPath): int
    {
        $totalSize = 0;

        if ($this->disk->exists($tempPath)) {
            $files = $this->disk->files($tempPath);
            foreach ($files as $file) {
                if (str_contains($file, 'chunk_')) {
                    $totalSize += $this->disk->size($file);
                }
            }
        }

        return $totalSize;
    }

    private function assembleChunks(string $tempPath, string $uploadName, int $expectedSize, string $uploadId): JsonResponse
    {
        // Generate filename from original name
        $fileName = $this->generateSafeFilename($uploadName);
        $filePath = "uploads/{$fileName}";

        // Ensure uploads directory exists
        $this->disk->makeDirectory('uploads');

        // Get all chunk files and sort by offset
        $chunks = $this->disk->files($tempPath);
        $chunks = collect($chunks)
            ->filter(fn ($file) => str_contains($file, 'chunk_'))
            ->sort(function ($a, $b) use ($tempPath) {
                $offsetA = (int) str_replace($tempPath.'/chunk_', '', $a);
                $offsetB = (int) str_replace($tempPath.'/chunk_', '', $b);

                return $offsetA <=> $offsetB;
            })
            ->values()
            ->all();

        // Assemble on a temporary disk stream. Concatenating chunks in a PHP
        // string duplicates tens of MB in memory and exhausts the 128 MB limit.
        $assembledStream = tmpfile();
        if ($assembledStream === false) {
            throw new UnableToWriteFile('Unable to create a temporary stream for the upload');
        }

        try {
            foreach ($chunks as $chunkFile) {
                $chunkStream = $this->disk->readStream($chunkFile);

                if ($chunkStream === false) {
                    throw new UnableToWriteFile("Unable to read chunk {$chunkFile}");
                }

                try {
                    if (stream_copy_to_stream($chunkStream, $assembledStream) === false) {
                        throw new UnableToWriteFile("Unable to assemble chunk {$chunkFile}");
                    }
                } finally {
                    fclose($chunkStream);
                }
            }

            rewind($assembledStream);

            if (! $this->disk->writeStream($filePath, $assembledStream)) {
                throw new UnableToWriteFile("Unable to write assembled file {$filePath}");
            }
        } finally {
            fclose($assembledStream);
        }

        // Verify file size
        $actualSize = $this->disk->size($filePath);
        if ($actualSize !== $expectedSize) {
            // Clean up on error
            $this->disk->delete($filePath);
            $this->cleanupTempChunks($tempPath);
            throw new UnableToWriteFile("File size mismatch: expected {$expectedSize}, got {$actualSize}");
        }

        // Save file info to database
        $file = $this->createFileRecord($uploadName, $filePath, $actualSize);

        // Clean up temp chunks
        $this->cleanupTempChunks($tempPath);

        // Return success response
        return $this->createSuccessResponse($file, [
            'uploadId' => (string) $file->id,
        ]);

    }

    private function cleanupEmptyChunks(string $tempPath, int $chunkSize): void
    {
        // If we have no chunks and this was an empty chunk, clean up immediately
        if ($this->getTotalChunksSize($tempPath) === 0 && $chunkSize === 0) {
            $this->cleanupTempChunks($tempPath);

            return;
        }

        // Also clean up if directory exists but has no valid chunks
        if ($this->disk->exists($tempPath)) {
            $files = $this->disk->files($tempPath);
            $hasValidChunks = collect($files)->some(function ($file) {
                return str_contains($file, 'chunk_') && $this->disk->size($file) > 0;
            });

            if (! $hasValidChunks) {
                $this->cleanupTempChunks($tempPath);
            }
        }
    }

    private function cleanupTempChunks(string $tempPath): void
    {
        if ($this->disk->exists($tempPath)) {
            $this->disk->deleteDirectory($tempPath);
        }
    }

    private function generateSafeFilename(string $originalName): string
    {
        // Sanitize the filename
        $name = pathinfo($originalName, PATHINFO_FILENAME);
        $extension = pathinfo($originalName, PATHINFO_EXTENSION);

        // Remove unsafe characters and replace with underscores
        $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $name);

        // Ensure filename isn't too long (max 100 chars for the name part)
        if (strlen($safeName) > 100) {
            $safeName = substr($safeName, 0, 100);
        }

        // Combine name and extension
        $fileName = $safeName.($extension ? '.'.$extension : '');

        // Check if file already exists and add counter if needed
        $counter = 1;

        while ($this->disk->exists("uploads/{$fileName}")) {
            $fileName = $safeName.'_'.$counter.($extension ? '.'.$extension : '');
            $counter++;
        }

        return $fileName;
    }

    private function createFileRecord(string $fileName, string $filePath, int $fileSize): File
    {
        $user = Auth::user();

        if (! $user instanceof User) {
            throw new \RuntimeException('Unable to save file record without an authenticated user.');
        }

        $file = $user->files()->create([
            'file_name' => $fileName,
            'file_path' => $filePath,
            'file_size' => $fileSize,
        ]);

        Cache::put(
            "import:{$file->id}",
            [
                'status' => 'uploaded',
                'path' => $file->file_path,
                'original_name' => $file->file_name,
                'size' => $file->file_size,
            ],
            now()->addHour(),
        );

        return $file;
    }

    private function createSuccessResponse(File $file, array $extra = []): JsonResponse
    {
        return response()->json(array_merge([
            'id' => $file->id,
            'file' => $file->file_name,
            'path' => $file->file_path,
            'size' => $file->file_size,
        ], $extra));
    }
}
