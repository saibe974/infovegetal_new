<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\DbProductBillingUser;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class OrderCsvService
{
    private const EVENTS = ['order', 'delivery', 'invoice', 'credit_note'];

    /**
     * @return array<int, array{filename:string, relative_path:string, disk:string, event:string, billing_user_id:int}>
     */
    public function generate(Cart $cart, User $client, array $payload): array
    {
        return $this->generateForEvent('order', $cart, $client, $payload);
    }

    /**
     * Shared entry point for order, delivery, invoice and credit-note generators.
     *
     * @return array<int, array{filename:string, relative_path:string, disk:string, event:string, billing_user_id:int}>
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
                if (! is_array($template) || ($template['event'] ?? null) !== $event || ! ($template['enabled'] ?? false)) {
                    continue;
                }

                $documentContext = [
                    'id' => $payload['document_id'] ?? $cart->id,
                    'number' => $documentNumber,
                    'date' => $documentDate,
                    'comment' => (string) ($payload['comment'] ?? ''),
                    'items_total' => $this->decimal($payload['items_total'] ?? 0),
                    'shipping_total' => $this->decimal($payload['shipping_total'] ?? 0),
                    'total' => $this->decimal($payload['total'] ?? 0),
                    'event' => $event,
                ];

                $csv = $this->render($template, $dbItems, [
                    'document' => $documentContext,
                    $event => $documentContext,
                    'client' => [
                        'id' => $client->id,
                        'name' => $client->name,
                        'email' => $client->email,
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
                ]);

                $templateName = Str::slug((string) ($template['name'] ?? 'commande-csv')) ?: 'commande-csv';
                $dbName = Str::slug((string) ($rule->dbProduct?->name ?? $dbProductId)) ?: (string) $dbProductId;
                $filename = sprintf('%s_%s_%s_%s.csv', $safeDocumentNumber, str_replace('-', '_', $documentDate), $templateName, $dbName);
                $relativePath = sprintf(
                    'commandes/facturants/%d/client-%d/%s',
                    $billingUserId,
                    $client->id,
                    $filename,
                );

                Storage::disk('local')->put($relativePath, $csv);
                $rule->billingUser?->files()->updateOrCreate(
                    ['file_path' => $relativePath],
                    ['file_name' => $filename, 'file_size' => strlen($csv)],
                );

                $generated[] = [
                    'filename' => $filename,
                    'relative_path' => $relativePath,
                    'disk' => 'local',
                    'event' => $event,
                    'billing_user_id' => (int) $billingUserId,
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
     * The client never receives billing files, even when they are also configured as a billing user.
     *
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
        if ($recipientId === $clientId) {
            return [];
        }

        return collect($generatedFiles)
            ->filter(fn ($file) => is_array($file)
                && (int) ($file['billing_user_id'] ?? 0) === $recipientId
                && is_string($file['relative_path'] ?? null))
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $items
     * @param  array<string, mixed>  $context
     */
    public function render(array $template, Collection $items, array $context): string
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

        $writeRows = function (Collection $rows, Collection $columns, ?array $item = null) use ($writeValues, $context): void {
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

    private function replaceVariables(string $value, array $context, ?array $item): string
    {
        $product = $item['product'] ?? null;
        $variables = [
            'product.id' => $product?->id,
            'product.reference' => $product?->ref ?: $product?->sku,
            'product.sku' => $product?->sku,
            'product.name' => $product?->name,
            'product.description' => $product?->description,
            'product.ean13' => $product?->ean13,
            'product.cond' => $product?->cond,
            'product.floor' => $product?->floor,
            'product.roll' => $product?->roll,
            'product.pot' => $product?->pot,
            'product.height' => $product?->height,
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

        $value = (string) preg_replace_callback(
            '/%calc:[^%]+%/i',
            fn ($matches) => $this->evaluateCalculation($matches[0], $variables) ?? $matches[0],
            $value,
        );

        return (string) preg_replace_callback(
            '/%([a-z0-9_.-]+)(?:\|(date|decimal):([a-z0-9]+))?%/i',
            function ($matches) use ($variables) {
                if (! array_key_exists($matches[1], $variables)) {
                    return $matches[0];
                }

                $replacement = $variables[$matches[1]];
                if (! is_scalar($replacement) && $replacement !== null) {
                    return $matches[0];
                }

                return $this->formatVariable(
                    (string) ($replacement ?? ''),
                    isset($matches[2], $matches[3]) ? strtolower($matches[2]).':'.$matches[3] : null,
                );
            },
            $value,
        );
    }

    private function evaluateCalculation(string $token, array $variables): ?string
    {
        if (preg_match('/^%calc:([^|%]+)(?:\|decimal:([0-4]))?%$/i', $token, $matches) !== 1) {
            return null;
        }

        $parts = preg_split('/([+\-*\/])/', $matches[1], -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);
        if (! is_array($parts) || count($parts) % 2 === 0) {
            return null;
        }

        $values = [];
        $operators = [];
        foreach ($parts as $index => $part) {
            if ($index % 2 === 1) {
                if (! in_array($part, ['+', '-', '*', '/'], true)) {
                    return null;
                }
                $operators[] = $part;

                continue;
            }

            if (is_numeric($part)) {
                $values[] = (float) $part;

                continue;
            }
            if (! preg_match('/^[a-z][a-z0-9_.]*$/i', $part) || ! array_key_exists($part, $variables) || ! is_numeric($variables[$part])) {
                return null;
            }
            $values[] = (float) $variables[$part];
        }

        $reducedValues = [$values[0]];
        $reducedOperators = [];
        foreach ($operators as $index => $operator) {
            $nextValue = $values[$index + 1];
            if ($operator === '*' || $operator === '/') {
                if ($operator === '/' && $nextValue == 0.0) {
                    return null;
                }
                $previous = array_pop($reducedValues);
                $reducedValues[] = $operator === '*'
                    ? $previous * $nextValue
                    : $previous / $nextValue;

                continue;
            }
            $reducedOperators[] = $operator;
            $reducedValues[] = $nextValue;
        }

        $result = $reducedValues[0];
        foreach ($reducedOperators as $index => $operator) {
            $result = $operator === '+'
                ? $result + $reducedValues[$index + 1]
                : $result - $reducedValues[$index + 1];
        }

        return isset($matches[2])
            ? number_format($result, (int) $matches[2], '.', '')
            : (string) $result;
    }

    private function formatVariable(string $value, ?string $format): string
    {
        if ($format === null || $format === '') {
            return $value;
        }

        if (preg_match('/^decimal:([0-4])$/', $format, $matches) === 1) {
            return is_numeric($value)
                ? number_format((float) $value, (int) $matches[1], '.', '')
                : $value;
        }

        if (in_array($format, ['date:dmy', 'date:ymd'], true)) {
            try {
                return Carbon::parse($value)->format($format === 'date:dmy' ? 'd/m/Y' : 'Y-m-d');
            } catch (\Throwable) {
                return $value;
            }
        }

        return $value;
    }

    private function decimal(mixed $value): string
    {
        return is_numeric($value) ? number_format((float) $value, 2, '.', '') : '';
    }
}
