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
            'columns' => array_values(self::metadata()),
            'defaults' => ['id', 'sku', 'name', 'price'],
            'template' => self::defaultTemplate(['id', 'sku', 'name', 'price']),
            'limits' => [
                'csv' => (int) config('product-export.csv_max_rows'),
                'xlsx' => (int) config('product-export.xlsx_max_rows'),
                'xlsx_cells' => (int) config('product-export.xlsx_max_cells'),
                'xlsx_images' => (int) config('product-export.xlsx_image_max_rows'),
            ],
        ];
    }

    public static function metadata(): array
    {
        return collect(self::COLUMNS)->map(fn ($label, $key) => [
            'key' => $key, 'label' => $label,
            'type' => match (true) {
                $key === 'image' => 'image',
                in_array($key, ['available_from', 'available_until'], true) => 'date',
                in_array($key, [...self::PRICES, 'id', 'pot', 'cond', 'floor', 'roll', 'unite', 'active'], true) => 'decimal',
                default => 'text',
            },
        ])->all();
    }

    private static function defaultTemplate(array $columns): array
    {
        return [
            'name' => 'Catalogue produits', 'filename' => 'products_export_%export.date%', 'delimiter' => ';',
            'blocks' => [[
                'id' => 'products', 'name' => 'Produits', 'type' => 'items', 'enabled' => true, 'show_headers' => true,
                'columns' => array_map(fn ($key) => ['id' => $key, 'name' => self::COLUMNS[$key]], $columns),
                'rows' => [['id' => 'product', 'cells' => array_combine($columns, array_map(fn ($key) => '%product.'.$key.'%', $columns))]],
            ]],
        ];
    }

    public function download(Request $request)
    {
        if (is_string($request->input('template'))) {
            $decoded = json_decode($request->input('template'), true);
            if (! is_array($decoded)) {
                throw ValidationException::withMessages(['template' => 'Modèle de fichier invalide.']);
            }
            $request->merge(['template' => $decoded]);
        }
        $data = $request->validate([
            'format' => ['required', Rule::in(['csv', 'xlsx'])],
            'template' => ['sometimes', 'array'],
            'columns' => ['required_without:template', 'array', 'min:1', 'max:'.count(self::COLUMNS)],
            'columns.*' => ['required', 'string', 'distinct', Rule::in(array_keys(self::COLUMNS))],
            'check' => ['sometimes', 'boolean'],
            'preview' => ['sometimes', 'boolean'],
        ]);

        $template = new ProductExportTemplate($data['template'] ?? self::defaultTemplate($data['columns']), self::metadata());
        $columns = $template->fields;
        $format = $data['format'];
        $query = (new ProductCatalogQuery($request))->query();
        $limitKey = $format === 'xlsx' && $template->imageCount(1) > 0 ? 'xlsx_image' : $format;
        $limit = (int) config("product-export.{$limitKey}_max_rows");
        if ($format === 'xlsx') {
            // Wide templates also consume memory: bound the workbook, not only its rows.
            $headings = count(array_filter($template->blocks, fn ($block) => $block['show_headers']));
            $limit = min($limit, max(0, intdiv((int) config('product-export.xlsx_max_cells'), $template->width()) - $headings));
        }
        $total = (clone $query)->reorder()->count();
        $context = ['export.date' => now()->format('Y-m-d'), 'export.count' => (string) $total];
        $lineCount = $template->rowCount($total);
        $imageCount = $format === 'xlsx' ? $template->imageCount($total) : 0;
        $tooLarge = $lineCount > $limit || $imageCount > (int) config('product-export.xlsx_image_max_rows');

        if (! $request->boolean('preview') && ($total === 0 || $tooLarge)) {
            throw ValidationException::withMessages([
                'export' => $total === 0
                    ? 'Aucun produit ne correspond aux filtres actuels.'
                    : "Cet export dépasse la limite de {$limit} lignes ou de ".config('product-export.xlsx_image_max_rows')." miniatures ({$total} produits, {$lineCount} lignes). Affinez les filtres, simplifiez le modèle ou choisissez le CSV.",
            ]);
        }

        if ($request->boolean('check')) {
            return response()->json(['total' => $total, 'rows' => $lineCount, 'limit' => $limit]);
        }

        // Match the index's preloaded pivot attributes (including an explicit
        // empty array), and resolve missing contexts only once per database.
        $this->attributesByDbId = [];
        if (($request->boolean('preview') || array_intersect(self::PRICES, $columns)) && $request->user()) {
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
        $filename = $template->filename($context, $format);

        if ($request->boolean('preview')) {
            $sample = (clone $query)->with(['category', 'dbProduct', 'media'])->limit(5)->get();
            $rows = [];
            $temporaryImages = [];
            try {
                foreach ($this->rows($query, $template, $request, $context, $sample) as $row) {
                    $rows[] = [
                        'heading' => $row['heading'],
                        'cells' => array_pad(array_map(function ($cell) use (&$temporaryImages) {
                            $product = $cell['image'];
                            $image = $product && $this->existingThumbnail($product, $temporaryImages)
                                ? $product->getFirstMedia('images')->getUrl('thumb') : null;

                            return ['value' => $cell['display'], 'image' => $image];
                        }, $row['cells']), $template->width(), ['value' => '', 'image' => null]),
                    ];
                }
            } finally {
                foreach ($temporaryImages as $path) {
                    @unlink($path);
                }
            }

            return response()->json([
                'total' => $total, 'rows' => $rows, 'sample_count' => $sample->count(),
                'line_count' => $lineCount, 'image_count' => $imageCount,
                'limit' => $limit, 'too_large' => $tooLarge, 'filename' => $filename,
                'values' => $sample->isNotEmpty() ? $this->variables($sample->first(), array_keys(self::metadata()), $request) + $context : $context,
            ]);
        }

        if ($format === 'csv') {
            return response()->streamDownload(function () use ($query, $template, $request, $context): void {
                $handle = fopen('php://output', 'wb');
                try {
                    fwrite($handle, "\xEF\xBB\xBF");
                    foreach ($this->rows($query, $template, $request, $context) as $row) {
                        $values = array_map(fn ($cell) => is_int($cell['value']) || is_float($cell['value']) ? $cell['display'] : $this->safeCsvCell($cell['display']), $row['cells']);
                        fputcsv($handle, array_pad($values, $template->width(), ''), $template->definition['delimiter'], '"', '');
                    }
                } finally {
                    fclose($handle);
                }
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8', 'X-Accel-Buffering' => 'no']);
        }

        return $this->excel($query, $template, $request, $context, $filename, $limit);
    }

    private function variables(Product $product, array $columns, Request $request): array
    {
        $values = array_combine(array_map(fn ($key) => 'product.'.$key, $columns), $this->values($product, $columns, $request));
        if (array_key_exists('product.ref', $values)) {
            $values['product.reference'] = $values['product.ref'];
        }

        return $values;
    }

    private function rows(Builder $query, ProductExportTemplate $template, Request $request, array $context, ?iterable $sample = null): \Generator
    {
        $renderer = app(FileRuleRenderer::class);
        $metadata = self::metadata();
        foreach ($template->blocks as $block) {
            if ($block['show_headers']) {
                yield ['heading' => true, 'cells' => array_map(fn ($column) => ['value' => $column['name'], 'display' => $column['name'], 'format' => null, 'image' => null], $block['columns'])];
            }
            $products = $block['type'] === 'items' ? ($sample ?? (clone $query)->lazy((int) config('product-export.chunk_size'))) : [null];
            foreach ($products as $product) {
                $variables = ($product ? $this->variables($product, $template->fields, $request) : []) + $context;
                foreach ($block['rows'] as $row) {
                    $cells = [];
                    foreach ($block['columns'] as $column) {
                        $rule = (string) ($row['cells'][$column['id']] ?? '');
                        $display = $renderer->render($rule, $variables, true);
                        $value = $display;
                        $format = null;
                        if (preg_match('/^%(product\.[a-z_0-9]+|export.count)(?:\|decimal:([0-4]))?%$/', $rule, $match)) {
                            $key = substr($match[1], 8);
                            if (($match[1] === 'export.count' || ($metadata[$key]['type'] ?? '') === 'decimal') && is_numeric($display)) {
                                $value = (float) $display;
                                $decimals = $match[2] ?? (in_array($key, self::PRICES, true) ? '2' : null);
                                $format = $decimals === null ? null : ($decimals === '0' ? '0' : '0.'.str_repeat('0', (int) $decimals));
                            }
                        } elseif (preg_match('/^%calc:[^%]+%$/', $rule) && is_numeric($display)) {
                            $value = (float) $display;
                            if (preg_match('/\|decimal:([0-4])%$/', $rule, $match)) {
                                $format = $match[1] === '0' ? '0' : '0.'.str_repeat('0', (int) $match[1]);
                            }
                        }
                        $cells[] = ['value' => $value, 'display' => $display, 'format' => $format, 'image' => $request->input('format') === 'xlsx' && $rule === '%product.image%' ? $product : null];
                    }
                    yield ['heading' => false, 'cells' => $cells];
                }
            }
        }
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

    private function excel(Builder $query, ProductExportTemplate $template, Request $request, array $context, string $filename, int $limit)
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
            for ($index = 1; $index <= $template->width(); $index++) {
                $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($index))->setWidth(24);
            }
            $row = 1;
            $dataRows = 0;
            $images = 0;
            foreach ($this->rows($query, $template, $request, $context) as $output) {
                if (! $output['heading'] && ++$dataRows > $limit) {
                    throw ValidationException::withMessages(['export' => 'Le catalogue a changé. Affinez les filtres puis relancez l’export.']);
                }
                foreach ($output['cells'] as $index => $data) {
                    $letter = Coordinate::stringFromColumnIndex($index + 1);
                    $cell = $letter.$row;
                    $value = $data['value'];
                    if ($product = $data['image']) {
                        if (++$images > (int) config('product-export.xlsx_image_max_rows')) {
                            throw ValidationException::withMessages(['export' => 'Trop de miniatures pour un export synchrone.']);
                        }
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
                    $sheet->setCellValueExplicit($cell, $value, is_int($value) || is_float($value) ? DataType::TYPE_NUMERIC : DataType::TYPE_STRING);
                    if ($data['format']) {
                        $sheet->getStyle($cell)->getNumberFormat()->setFormatCode($data['format']);
                    }
                    if ($output['heading']) {
                        $sheet->getStyle($cell)->getFont()->setBold(true);
                        $sheet->getRowDimension($row)->setRowHeight(26);
                    }
                }
                $row++;
            }
            if (count($template->blocks) === 1 && $template->blocks[0]['show_headers']) {
                $sheet->setAutoFilter('A1:'.Coordinate::stringFromColumnIndex($template->width()).($row - 1));
            }
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
