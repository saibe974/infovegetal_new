<?php

namespace App\Services;

use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class ProductExportService
{
    private const COLUMNS = [
        'id' => 'ID',
        'sku' => 'SKU',
        'name' => 'Nom',
        'image' => 'Image',
        'ref' => 'Référence',
        'ean13' => 'EAN13',
        'description' => 'Description',
        'category' => 'Catégorie',
        'database' => 'Base produits',
        'country' => 'Pays',
        'pot' => 'Diamètre du pot',
        'height' => 'Hauteur',
        'price' => 'Prix HT',
        'price_floor' => 'Prix étage HT',
        'price_roll' => 'Prix roll HT',
        'price_promo' => 'Prix promo HT',
        'cond' => 'Conditionnement',
        'floor' => 'Quantité par étage',
        'roll' => 'Quantité par roll',
        'unite' => 'Unité',
        'active' => 'Actif',
        'available_from' => 'Disponible à partir du',
        'available_until' => 'Disponible jusqu’au',
    ];

    private const PRICES = ['price', 'price_floor', 'price_roll', 'price_promo'];

    private array $attributesByDbId = [];

    public static function options(): array
    {
        return [
            'columns' => collect(self::COLUMNS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'defaults' => ['id', 'sku', 'name', 'price'],
            'limits' => [
                'csv' => (int) config('product-export.csv_max_rows'),
                'xlsx' => (int) config('product-export.xlsx_max_rows'),
                'xlsx_images' => (int) config('product-export.xlsx_image_max_rows'),
            ],
        ];
    }

    public function download(Request $request)
    {
        $data = $request->validate([
            'format' => ['required', Rule::in(['csv', 'xlsx'])],
            'columns' => ['required', 'array', 'min:1', 'max:'.count(self::COLUMNS)],
            'columns.*' => ['required', 'string', 'distinct', Rule::in(array_keys(self::COLUMNS))],
            'check' => ['sometimes', 'boolean'],
        ]);

        $columns = $data['columns'];
        $format = $data['format'];
        $query = (new ProductCatalogQuery($request))->query();
        $limitKey = $format === 'xlsx' && in_array('image', $columns, true) ? 'xlsx_image' : $format;
        $limit = (int) config("product-export.{$limitKey}_max_rows");
        $total = (clone $query)->reorder()->count();

        if ($total === 0 || $total > $limit) {
            throw ValidationException::withMessages([
                'export' => $total === 0
                    ? 'Aucun produit ne correspond aux filtres actuels.'
                    : "Cet export est limité à {$limit} produits ({$total} sélectionnés). Affinez les filtres ou choisissez le CSV.",
            ]);
        }

        if ($request->boolean('check')) {
            return response()->json(['total' => $total, 'limit' => $limit]);
        }

        // Match the index's preloaded pivot attributes (including an explicit
        // empty array), and resolve missing contexts only once per database.
        $this->attributesByDbId = [];
        if (array_intersect(self::PRICES, $columns) && $request->user()) {
            foreach ($request->user()->dbProducts()->get() as $database) {
                $raw = $database->pivot?->attributes;
                $attributes = is_string($raw) ? json_decode($raw, true) : $raw;
                if (is_array($attributes)) {
                    $this->attributesByDbId[(int) $database->id] = $attributes;
                }
            }
        }

        $relations = [];
        if (in_array('category', $columns, true)) {
            $relations[] = 'category';
        }
        if (array_intersect(['database', 'country'], $columns)) {
            $relations[] = 'dbProduct';
        }
        if (in_array('image', $columns, true)) {
            $relations[] = 'media';
        }
        $query->with($relations);
        $filename = 'products_export_'.now()->format('Ymd_His').'.'.$format;

        if ($format === 'csv') {
            return response()->streamDownload(function () use ($query, $columns, $request): void {
                $handle = fopen('php://output', 'wb');
                try {
                    fwrite($handle, "\xEF\xBB\xBF");
                    fputcsv($handle, array_map(fn ($key) => self::COLUMNS[$key], $columns), ';', '"', '');
                    foreach ($query->lazy((int) config('product-export.chunk_size')) as $product) {
                        $values = $this->values($product, $columns, $request);
                        fputcsv($handle, array_map($this->safeCsvCell(...), $values), ';', '"', '');
                    }
                } finally {
                    fclose($handle);
                }
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8', 'X-Accel-Buffering' => 'no']);
        }

        return $this->excel($query, $columns, $request, $filename, $limit);
    }

    private function values(Product $product, array $columns, Request $request): array
    {
        $withPrices = array_intersect(self::PRICES, $columns);
        $dbId = (int) $product->db_products_id;
        if ($withPrices && $dbId && $request->user()) {
            if (! array_key_exists($dbId, $this->attributesByDbId)) {
                $this->attributesByDbId[$dbId] = app(PriceCalculatorService::class)
                    ->resolveUserAttributes($request->user(), $dbId) ?? [];
            }
            $product->setAttribute('db_user_attributes', $this->attributesByDbId[$dbId]);
        }

        $prices = $withPrices
            ? (new ProductResource($product))->resolvedPrices($request)
            : [];

        return array_map(function ($key) use ($product, $prices, $request) {
            if (in_array($key, self::PRICES, true)) {
                return isset($prices[$key]) ? (float) $prices[$key] : null;
            }

            return match ($key) {
                'image' => $request->input('format') === 'csv' ? $product->img_link : null,
                'category' => $product->category?->name,
                'database' => $product->dbProduct?->name,
                'country' => $product->dbProduct?->country,
                'active' => $product->active ? 1 : 0,
                'available_from', 'available_until' => $product->{$key}?->format('Y-m-d H:i'),
                default => $product->{$key},
            };
        }, $columns);
    }

    private function safeCsvCell(mixed $value): mixed
    {
        // Spreadsheet applications must not execute catalogue text as formulas.
        if (is_string($value) && preg_match('/^(?:[\t\r\n]|\s*[=+@-])/u', $value)) {
            return "'".$value;
        }

        return $value;
    }

    private function excel(Builder $query, array $columns, Request $request, string $filename, int $limit)
    {
        $spreadsheet = new Spreadsheet;
        $temporaryImages = [];
        $path = tempnam(sys_get_temp_dir(), 'products_export_');
        if ($path === false) {
            throw new \RuntimeException('Impossible de créer le fichier temporaire.');
        }

        try {
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Produits');
            $sheet->freezePane('A2');
            $sheet->getDefaultRowDimension()->setRowHeight(20);
            foreach ($columns as $index => $key) {
                $letter = Coordinate::stringFromColumnIndex($index + 1);
                $sheet->setCellValueExplicit($letter.'1', self::COLUMNS[$key], DataType::TYPE_STRING);
                $sheet->getColumnDimension($letter)->setWidth(match ($key) {
                    'name', 'description' => 45,
                    'image' => 14,
                    default => 22,
                });
            }

            $row = 2;
            foreach ($query->lazy((int) config('product-export.chunk_size')) as $product) {
                // Recheck while generating in case the catalogue grew after the count.
                if ($row > $limit + 1) {
                    throw ValidationException::withMessages(['export' => 'Le catalogue a changé. Affinez les filtres puis relancez l’export.']);
                }
                foreach ($this->values($product, $columns, $request) as $index => $value) {
                    $letter = Coordinate::stringFromColumnIndex($index + 1);
                    $cell = $letter.$row;
                    $key = $columns[$index];
                    if ($key === 'image') {
                        $thumbnail = $this->existingThumbnail($product, $temporaryImages);
                        if ($thumbnail !== null) {
                            $drawing = new Drawing;
                            $drawing->setName('Miniature produit '.$product->id);
                            $drawing->setPath($thumbnail);
                            $drawing->setCoordinates($cell);
                            $drawing->setWidthAndHeight(72, 72);
                            $drawing->setOffsetX(4)->setOffsetY(4);
                            $drawing->setWorksheet($sheet);
                            $sheet->getRowDimension($row)->setRowHeight(60);
                        }

                        continue;
                    }
                    if ($value !== null) {
                        $numeric = is_int($value) || is_float($value);
                        $sheet->setCellValueExplicit($cell, $value, $numeric ? DataType::TYPE_NUMERIC : DataType::TYPE_STRING);
                    }
                    if (in_array($key, self::PRICES, true)) {
                        $sheet->getStyle($cell)->getNumberFormat()->setFormatCode('0.00');
                    }
                }
                $row++;
            }

            $lastColumn = Coordinate::stringFromColumnIndex(count($columns));
            $sheet->getStyle("A1:{$lastColumn}1")->getFont()->setBold(true);
            $sheet->getRowDimension(1)->setRowHeight(26);
            $sheet->setAutoFilter("A1:{$lastColumn}".($row - 1));
            $writer = new Xlsx($spreadsheet);
            $writer->setPreCalculateFormulas(false);
            $writer->save($path);

            return response()->download($path, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])->deleteFileAfterSend(true);
        } catch (\Throwable $exception) {
            @unlink($path);
            throw $exception;
        } finally {
            $spreadsheet->disconnectWorksheets();
            foreach ($temporaryImages as $image) {
                @unlink($image);
            }
        }
    }

    private function existingThumbnail(Product $product, array &$temporaryImages): ?string
    {
        $media = $product->getFirstMedia('images');
        if (! $media || ! $media->hasGeneratedConversion('thumb')) {
            return null;
        }

        // Read only an existing conversion on its configured disk. Never fetch an
        // original/img_link or call the conversion generator during an export.
        $media->setRelation('model', $product);
        $disk = Storage::disk($media->conversions_disk ?: $media->disk);
        $relativePath = $media->getPathRelativeToRoot('thumb');
        if (! $disk->exists($relativePath)) {
            return null;
        }

        $maxBytes = (int) config('product-export.thumbnail_max_bytes');
        if ($disk->size($relativePath) > $maxBytes) {
            return null;
        }
        $stream = $disk->readStream($relativePath);
        if (! is_resource($stream)) {
            return null;
        }
        try {
            $bytes = stream_get_contents($stream, $maxBytes + 1);
        } finally {
            fclose($stream);
        }
        if ($bytes === false || strlen($bytes) > $maxBytes) {
            return null;
        }
        $size = @getimagesizefromstring($bytes);
        if (! $size || ! in_array($size['mime'], ['image/jpeg', 'image/png', 'image/gif'], true)
            || $size[0] > 512 || $size[1] > 512) {
            return null;
        }
        $path = tempnam(sys_get_temp_dir(), 'product_thumb_');
        if ($path === false) {
            return null;
        }
        $temporaryImages[] = $path;
        if (file_put_contents($path, $bytes) === false) {
            return null;
        }

        return $path;
    }
}
