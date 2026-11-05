<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

class ImportUploadPolicy
{
    public function validateName(string $name): string
    {
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (strlen($name) > 200 || preg_match('~[\\\\/\x00-\x1f]~', $name)
            || ! in_array($extension, ['csv', 'tsv', 'xls', 'xlsx'], true)
            || preg_match('/\.(php\d*|phtml|phar|cgi|html?|js)(\.|$)/i', $name)) {
            throw ValidationException::withMessages(['file' => 'Format de fichier interdit.']);
        }

        return $extension;
    }

    public function validateFile(string $path, string $name, int $size): string
    {
        $extension = $this->validateName($name);
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        $valid = $size > 0 && $size <= config('uploads.max_bytes');
        if (in_array($extension, ['csv', 'tsv'], true)) {
            $head = file_get_contents($path, false, null, 0, 8192);
            $valid = $valid && in_array($mime, ['text/plain', 'text/csv', 'text/tab-separated-values', 'application/csv'], true)
                && ! str_contains($head, "\0") && ! preg_match('/<\?(?:php|=)|<script\b/i', $head);
        } elseif ($extension === 'xlsx') {
            $zip = new \ZipArchive;
            $opened = $zip->open($path) === true;
            $valid = $valid && $opened && $zip->locateName('[Content_Types].xml') !== false
                && $zip->locateName('xl/workbook.xml') !== false;
            if ($opened) {
                $zip->close();
            }
        } else {
            $valid = $valid && in_array($mime, ['application/vnd.ms-excel', 'application/x-ole-storage', 'application/CDFV2'], true);
        }
        if (! $valid) {
            throw ValidationException::withMessages(['file' => 'Type ou taille du fichier invalide.']);
        }

        return match ($extension) {
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls' => 'application/vnd.ms-excel',
            'tsv' => 'text/tab-separated-values',
            default => 'text/csv',
        };
    }
}
