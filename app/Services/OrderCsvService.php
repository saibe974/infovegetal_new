<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\DbProductBillingUser;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class OrderCsvService
{
    private const EVENTS = ['order', 'delivery', 'invoice', 'credit_note'];

    /**
     * @return array<int, array{filename:string, relative_path:string, disk:string, event:string, billing_user_id:int, seller_user_id:int, client_user_id:int, shared:bool, mime:string}>
     */
    public function generate(Cart $cart, User $client, array $payload): array
    {
        return $this->generateForEvent('order', $cart, $client, $payload);
    }

    /**
     * Shared entry point for order, delivery, invoice and credit-note generators.
     *
     * @return array<int, array{filename:string, relative_path:string, disk:string, event:string, billing_user_id:int, seller_user_id:int, client_user_id:int, shared:bool, mime:string}>
     */
    public function generateForEvent(string $event, Cart $cart, User $client, array $payload): array
    {
        if (! in_array($event, self::EVENTS, true)) {
            throw new \InvalidArgumentException("Unsupported billing file event [{$event}].");
        }

        $items = collect($payload['items'] ?? []);
        $billingContext = is_array($payload['billing_context_by_db'] ?? null)
            ? $payload['billing_context_by_db']
            : [];
        $documentNumber = (string) (
            $payload['document_number']
            ?? $payload[$event.'_number']
            ?? $payload['order_number']
            ?? str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT)
        );
        $documentDate = (string) ($payload['document_date'] ?? now()->format('Y-m-d'));
        $safeDocumentNumber = Str::slug($documentNumber) ?: (string) $cart->id;
        $generated = [];

        foreach ($items->groupBy(fn ($item) => (int) ($item['product']->db_products_id ?? 0)) as $dbProductId => $dbItems) {
            $dbProductId = (int) $dbProductId;
            $billingUserId = (int) ($billingContext[$dbProductId]['billing_user_id'] ?? 0);
            if ($dbProductId <= 0 || $billingUserId <= 0) {
                continue;
            }

            $rule = DbProductBillingUser::query()
                ->with(['billingUser', 'dbProduct'])
                ->where('db_product_id', $dbProductId)
                ->where('billing_user_id', $billingUserId)
                ->where('active', true)
                ->first();

            $templates = is_array($rule?->defaults['files'] ?? null)
                ? $rule->defaults['files']
                : [];

            foreach ($templates as $template) {
                if (! is_array($template)
                    || ($template['id'] ?? null) === 'order-pdf'
                    || ! in_array($event, $this->templateEvents($template), true)
                    || ! ($template['enabled'] ?? false)) {
                    continue;
                }

                $documentContext = [
                    'id' => $payload['document_id'] ?? $cart->id,
                    'number' => $documentNumber,
                    'date' => $documentDate,
                    'count' => (string) $dbItems->count(),
                    'comment' => (string) ($payload['comment'] ?? ''),
                    'items_total' => $this->decimal($payload['items_total'] ?? 0),
                    'shipping_total' => $this->decimal($payload['shipping_total'] ?? 0),
                    'total' => $this->decimal($payload['total'] ?? 0),
                    'event' => $event,
                ];

                $context = [
                    'document' => $documentContext,
                    $event => $documentContext,
                    'client' => [
                        'id' => $client->id,
                        'name' => $client->name,
                        'email' => $client->email,
                        'ref' => $client->ref,
                        'alias' => $client->alias,
                    ],
                    'billing' => [
                        'id' => $rule->billingUser?->id,
                        'name' => $rule->billingUser?->name,
                        'email' => $rule->billingUser?->email,
                    ],
                    'db' => [
                        'id' => $rule->dbProduct?->id,
                        'name' => $rule->dbProduct?->name,
                    ],
                ];
                $extension = in_array($template['extension'] ?? null, ['csv', 'tsv', 'xlsx'], true)
                    ? $template['extension']
                    : (in_array($template['delimiter'] ?? null, ["\t", '|'], true) ? 'tsv' : 'csv');
                $contents = $extension === 'xlsx'
                    ? $this->renderXlsx($template, $dbItems, $context)
                    : $this->render($template, $dbItems, $context);
                $templateName = Str::slug((string) ($template['name'] ?? 'fichier')) ?: 'fichier';
                $fallbackName = sprintf(
                    '%s_%s_%s_%s',
                    $safeDocumentNumber,
                    str_replace('-', '_', $documentDate),
                    $templateName,
                    Str::slug((string) ($rule->dbProduct?->name ?? $dbProductId)) ?: (string) $dbProductId,
                );
                $filename = $this->resolveFilename(
                    (string) ($template['filename'] ?? ''),
                    $context,
                    $dbItems->first(),
                    $extension,
                    $fallbackName,
                );
                $storageFilename = sprintf(
                    '%s_%s_%s_db-%d.%s',
                    $event,
                    $safeDocumentNumber,
                    Str::slug((string) ($template['id'] ?? $templateName)) ?: $templateName,
                    $dbProductId,
                    $extension,
                );
                $relativePath = sprintf(
                    'commandes/facturants/%d/client-%d/%s',
                    $billingUserId,
                    $client->id,
                    $storageFilename,
                );

                Storage::disk('local')->put($relativePath, $contents);
                $rule->billingUser?->files()->updateOrCreate(
                    ['file_path' => $relativePath],
                    ['file_name' => $filename, 'file_size' => strlen($contents)],
                );

                $generated[] = [
                    'filename' => $filename,
                    'relative_path' => $relativePath,
                    'disk' => 'local',
                    'event' => $event,
                    'billing_user_id' => (int) $billingUserId,
                    'seller_user_id' => (int) ($billingContext[$dbProductId]['seller_user_id'] ?? 0),
                    'client_user_id' => (int) $client->id,
                    'shared' => (bool) ($template['shared'] ?? false),
                    'mime' => match ($extension) {
                        'tsv' => 'text/tab-separated-values',
                        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        default => 'text/csv',
                    },
                ];
            }
        }

        return $generated;
    }

    /**
     * @param  array<int, array<string, mixed>>  $generatedFiles
     * @return array<int, string>
     */
    public function attachmentPathsForBillingUser(array $generatedFiles, int $billingUserId): array
    {
        return collect($generatedFiles)
            ->filter(fn ($file) => is_array($file)
                && (int) ($file['billing_user_id'] ?? 0) === $billingUserId
                && is_string($file['relative_path'] ?? null))
            ->pluck('relative_path')
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $generatedFiles
     * @return array<int, string>
     */
    public function attachmentPathsForRecipient(array $generatedFiles, int $recipientId, int $clientId): array
    {
        return collect($this->attachmentsForRecipient($generatedFiles, $recipientId, $clientId))
            ->pluck('relative_path')
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $generatedFiles
     * @return array<int, array<string, mixed>>
     */
    public function attachmentsForRecipient(array $generatedFiles, int $recipientId, int $clientId): array
    {
        return collect($generatedFiles)
            ->filter(fn ($file) => is_array($file)
                && (
                    (int) ($file['billing_user_id'] ?? 0) === $recipientId
                    || (
                        ($file['shared'] ?? false) === true
                        && (
                            $recipientId === $clientId
                            || (int) ($file['seller_user_id'] ?? 0) === $recipientId
                        )
                    )
                )
                && is_string($file['relative_path'] ?? null))
            ->values()
            ->all();
    }

    public function resolveOrderPdfFilename(
        Cart $cart,
        User $client,
        array $payload,
        string $fallbackFilename,
    ): string {
        $items = collect($payload['items'] ?? []);
        $billingContext = is_array($payload['billing_context_by_db'] ?? null)
            ? $payload['billing_context_by_db']
            : [];
        $documentNumber = (string) ($payload['order_number'] ?? $payload['document_number'] ?? $cart->id);
        $documentDate = (string) ($payload['document_date'] ?? now()->format('Y-m-d'));

        foreach ($items->groupBy(fn ($item) => (int) ($item['product']->db_products_id ?? 0)) as $dbProductId => $dbItems) {
            $dbProductId = (int) $dbProductId;
            $billingUserId = (int) ($billingContext[$dbProductId]['billing_user_id'] ?? 0);
            if ($dbProductId <= 0 || $billingUserId <= 0) {
                continue;
            }

            $rule = DbProductBillingUser::query()
                ->with(['billingUser', 'dbProduct'])
                ->where('db_product_id', $dbProductId)
                ->where('billing_user_id', $billingUserId)
                ->where('active', true)
                ->first();
            $template = collect($rule?->defaults['files'] ?? [])->first(
                fn ($file) => is_array($file) && ($file['id'] ?? null) === 'order-pdf',
            );
            if (! is_array($template)) {
                continue;
            }

            $documentContext = [
                'id' => $payload['document_id'] ?? $cart->id,
                'number' => $documentNumber,
                'date' => $documentDate,
                'count' => (string) $dbItems->count(),
                'comment' => (string) ($payload['comment'] ?? ''),
                'items_total' => $this->decimal($payload['items_total'] ?? 0),
                'shipping_total' => $this->decimal($payload['shipping_total'] ?? 0),
                'total' => $this->decimal($payload['total'] ?? 0),
                'event' => 'order',
            ];
            $context = [
                'document' => $documentContext,
                'order' => $documentContext,
                'client' => ['id' => $client->id, 'name' => $client->name, 'email' => $client->email, 'ref' => $client->ref, 'alias' => $client->alias],
                'billing' => [
                    'id' => $rule->billingUser?->id,
                    'name' => $rule->billingUser?->name,
                    'email' => $rule->billingUser?->email,
                ],
                'db' => ['id' => $rule->dbProduct?->id, 'name' => $rule->dbProduct?->name],
            ];

            return $this->resolveFilename(
                (string) ($template['filename'] ?? ''),
                $context,
                $dbItems->first(),
                'pdf',
                pathinfo($fallbackFilename, PATHINFO_FILENAME),
            );
        }

        return $fallbackFilename;
    }

    /** @return array<int, string> */
    private function templateEvents(array $template): array
    {
        $events = is_array($template['events'] ?? null)
            ? $template['events']
            : [$template['event'] ?? 'order'];

        return array_values(array_filter(
            $events,
            fn ($event) => is_string($event) && in_array($event, self::EVENTS, true),
        ));
    }

    private function resolveFilename(
        string $rule,
        array $context,
        mixed $item,
        string $extension,
        string $fallback,
    ): string {
        $resolved = $this->replaceVariables(
            $rule,
            $context,
            is_array($item) ? $item : null,
        );
        $resolved = (string) preg_replace('/\.(?:csv|tsv|xlsx|pdf|xls)$/i', '', trim($resolved));
        $resolved = (string) preg_replace('/[<>:"\/\\|?*\x00-\x1F]+/u', '-', $resolved);
        $resolved = trim((string) preg_replace('/\s+/u', ' ', $resolved), ". \t\n\r\0\x0B");

        if ($resolved === '' || str_contains($resolved, '%')) {
            $resolved = $fallback;
        }

        return Str::limit($resolved, 180, '').'.'.$extension;
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $items
     * @param  array<string, mixed>  $context
     */
    public function render(array $template, Collection $items, array $context, string $imageMode = 'url'): string
    {
        $legacyColumns = collect($template['columns'] ?? [])->filter(fn ($column) => is_array($column))->values();
        $blocks = collect($template['blocks'] ?? [])->filter(fn ($block) => is_array($block))->values();
        if ($blocks->isEmpty()) {
            $blocks = collect([[
                'id' => 'legacy-lines',
                'name' => 'Legacy lines',
                'type' => ($template['scope'] ?? 'document') === 'items' ? 'items' : 'header',
                'enabled' => true,
                'show_headers' => true,
                'columns' => $legacyColumns->all(),
                'rows' => $template['rows'] ?? [],
            ]]);
        }

        $blocks = $blocks->filter(fn ($block) => ($block['enabled'] ?? true) !== false)->values();
        $width = $blocks
            ->map(fn ($block) => collect($block['columns'] ?? $legacyColumns)->filter(fn ($column) => is_array($column))->count())
            ->max() ?? 0;
        $delimiter = in_array($template['delimiter'] ?? ';', [';', ',', "\t", '|'], true)
            ? $template['delimiter']
            : ';';
        $stream = fopen('php://temp', 'w+');
        fwrite($stream, "\xEF\xBB\xBF");

        $writeValues = function (array $values) use ($stream, $delimiter, $width): void {
            fputcsv($stream, array_pad($values, $width, ''), $delimiter, '"', '');
        };

        $writeRows = function (Collection $rows, Collection $columns, ?array $item = null) use ($writeValues, $context, $imageMode): void {
            foreach ($rows as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $cells = is_array($row['cells'] ?? null) ? $row['cells'] : [];
                $writeValues(
                    $columns->map(fn ($column) => $this->replaceVariables(
                        (string) ($cells[(string) ($column['id'] ?? '')] ?? ''),
                        $context,
                        $item,
                        $imageMode,
                    ))->all(),
                );
            }
        };

        foreach ($blocks as $block) {
            $columns = collect($block['columns'] ?? $legacyColumns)->filter(fn ($column) => is_array($column))->values();
            $rows = collect($block['rows'] ?? [])->filter(fn ($row) => is_array($row))->values();

            if (($block['show_headers'] ?? (($block['type'] ?? null) === 'items')) === true) {
                $writeValues($columns->pluck('name')->map(fn ($name) => (string) $name)->all());
            }

            if (($block['type'] ?? 'header') === 'items') {
                foreach ($items as $item) {
                    $writeRows($rows, $columns, is_array($item) ? $item : null);
                }

                continue;
            }

            $writeRows($rows, $columns);
        }

        rewind($stream);
        $contents = stream_get_contents($stream);
        fclose($stream);

        return is_string($contents) ? $contents : '';
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $items
     */
    public function renderXlsx(array $template, Collection $items, array $context): string
    {
        $csv = $this->render($template, $items, $context, 'marker');
        $delimiter = in_array($template['delimiter'] ?? ';', [';', ',', "\t", '|'], true)
            ? $template['delimiter']
            : ';';
        $input = fopen('php://temp', 'w+');
        fwrite($input, preg_replace('/^\xEF\xBB\xBF/', '', $csv) ?? $csv);
        rewind($input);

        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $temporaryImages = [];
        $rowNumber = 1;
        while (($row = fgetcsv($input, null, $delimiter, '"', '')) !== false) {
            foreach ($row as $columnIndex => $value) {
                if (preg_match('/^__USER_IMAGE_(\d+)__$/', (string) $value, $matches) === 1) {
                    $path = app(FileImageRuleService::class)->temporaryPath((int) $matches[1], $temporaryImages);
                    if ($path) {
                        $cell = Coordinate::stringFromColumnIndex($columnIndex + 1).$rowNumber;
                        $drawing = new Drawing;
                        $drawing->setName('Image fixe');
                        $drawing->setPath($path);
                        $drawing->setCoordinates($cell);
                        $drawing->setWidthAndHeight(96, 72);
                        $drawing->setOffsetX(4)->setOffsetY(4);
                        $drawing->setWorksheet($sheet);
                        $sheet->getRowDimension($rowNumber)->setRowHeight(60);
                    }

                    continue;
                }
                $sheet->setCellValueExplicit(
                    Coordinate::stringFromColumnIndex($columnIndex + 1).$rowNumber,
                    (string) $value,
                    DataType::TYPE_STRING,
                );
            }
            $rowNumber++;
        }
        fclose($input);

        ob_start();
        (new Xlsx($spreadsheet))->save('php://output');
        $contents = ob_get_clean();
        $spreadsheet->disconnectWorksheets();
        foreach ($temporaryImages as $path) {
            @unlink($path);
        }

        return is_string($contents) ? $contents : '';
    }

    private function replaceVariables(string $value, array $context, ?array $item, string $imageMode = 'url'): string
    {
        $fixedImageId = app(FileImageRuleService::class)->mediaId($value);
        if ($fixedImageId !== null) {
            return $imageMode === 'marker'
                ? '__USER_IMAGE_'.$fixedImageId.'__'
                : app(FileImageRuleService::class)->url($fixedImageId);
        }
        $product = $item['product'] ?? null;
        $variables = [
            'product.id' => $product?->id,
            'product.reference' => $product?->ref ?: $product?->sku,
            'product.ref' => $product?->ref ?: $product?->sku,
            'product.sku' => $product?->sku,
            'product.name' => $product?->name,
            'product.description' => $product?->description,
            'product.image' => $product ? ($product->getAttributes()['img_link'] ?? null) : null,
            'product.ean13' => $product?->ean13,
            'product.cond' => $product?->cond,
            'product.floor' => $product?->floor,
            'product.roll' => $product?->roll,
            'product.pot' => $product?->pot,
            'product.height' => $product?->height,
            'product.price' => $product?->price,
            'product.price_floor' => $product?->price_floor,
            'product.price_roll' => $product?->price_roll,
            'product.price_promo' => $product?->price_promo,
            'quantity' => $item['quantity'] ?? null,
            'unit_price' => $this->decimal($item['unit_price'] ?? null),
            'line_total' => $this->decimal($item['line_total'] ?? null),
            'comment' => $item['comment'] ?? null,
        ];

        foreach ($context as $group => $entries) {
            if (! is_array($entries)) {
                continue;
            }
            foreach ($entries as $key => $entry) {
                $variables[$group.'.'.$key] = $entry;
            }
        }

        return app(FileRuleRenderer::class)->render($value, $variables);
    }

    private function decimal(mixed $value): string
    {
        return is_numeric($value) ? number_format((float) $value, 2, '.', '') : '';
    }
}
