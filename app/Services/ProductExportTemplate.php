<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** A bounded, validated file definition, independent of the output format. */
class ProductExportTemplate
{
    public readonly array $definition;

    public readonly array $blocks;

    public readonly array $fields;

    public function __construct(array $definition, private readonly array $metadata)
    {
        // Laravel's required rule treats a literal tab as an empty string.
        if (($definition['delimiter'] ?? null) === "\t") {
            $definition['delimiter'] = 'tab';
        }
        $validated = Validator::make($definition, [
            'name' => ['required', 'string', 'max:120'],
            'filename' => ['required', 'string', 'max:120'],
            'delimiter' => ['required', Rule::in([';', ',', 'tab', '|'])],
            'blocks' => ['required', 'array', 'min:1', 'max:5'],
            'blocks.*.id' => ['required', 'string', 'max:100', 'distinct'],
            'blocks.*.name' => ['required', 'string', 'max:120'],
            'blocks.*.type' => ['required', Rule::in(['header', 'items', 'footer'])],
            'blocks.*.enabled' => ['required', 'boolean'],
            'blocks.*.show_headers' => ['required', 'boolean'],
            'blocks.*.columns' => ['required', 'array', 'min:1', 'max:40'],
            'blocks.*.columns.*.id' => ['required', 'string', 'max:100'],
            'blocks.*.columns.*.name' => ['required', 'string', 'max:120'],
            'blocks.*.rows' => ['required', 'array', 'min:1', 'max:5'],
            'blocks.*.rows.*.id' => ['required', 'string', 'max:100'],
            'blocks.*.rows.*.cells' => ['present', 'array', 'max:40'],
            'blocks.*.rows.*.cells.*' => ['nullable', 'string', 'max:1000'],
        ])->validate();
        $validated['delimiter'] = $validated['delimiter'] === 'tab' ? "\t" : $validated['delimiter'];
        $this->definition = $validated;
        $this->blocks = array_values(array_filter($this->definition['blocks'], fn ($block) => $block['enabled']));
        if (! collect($this->blocks)->contains(fn ($block) => $block['type'] === 'items')) {
            $this->invalid('Ajoutez au moins un bloc de produits actif.');
        }

        $fields = [];
        $this->validateRule($this->definition['filename'], false, $fields);
        foreach ($this->definition['blocks'] as $block) {
            $columnIds = array_column($block['columns'], 'id');
            if (count(array_unique($columnIds)) !== count($columnIds)) {
                $this->invalid('Les identifiants de colonnes doivent être uniques dans chaque bloc.');
            }
            foreach ($block['rows'] as $row) {
                foreach ($columnIds as $id) {
                    $this->validateRule((string) ($row['cells'][$id] ?? ''), $block['type'] === 'items', $fields);
                }
            }
        }
        $this->fields = array_values(array_unique($fields));
    }

    public function rowCount(int $products, bool $includeHeadings = false): int
    {
        return array_sum(array_map(fn ($block) => count($block['rows']) * ($block['type'] === 'items' ? $products : 1)
            + ($includeHeadings && $block['show_headers'] ? 1 : 0), $this->blocks));
    }

    public function imageCount(int $products): int
    {
        $count = 0;
        foreach ($this->blocks as $block) {
            foreach ($block['rows'] as $row) {
                foreach ($block['columns'] as $column) {
                    if (($row['cells'][$column['id']] ?? '') === '%product.image%') {
                        $count += $products;
                    }
                }
            }
        }

        return $count;
    }

    public function filename(array $context, string $extension): string
    {
        $name = app(FileRuleRenderer::class)->render($this->definition['filename'], $context, true);
        $name = preg_replace('/\.(csv|xlsx|xls|tsv)$/i', '', trim($name));
        $name = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F]+/u', '-', $name);
        $name = trim($name, ". \t\n\r\0\x0B");

        return mb_substr($name ?: 'products_export', 0, 160).'.'.$extension;
    }

    public function width(): int
    {
        return max(array_map(fn ($block) => count($block['columns']), $this->blocks));
    }

    private function validateRule(string $rule, bool $items, array &$fields): void
    {
        preg_match_all('/%([^%]+)%/', $rule, $tokens);
        foreach ($tokens[1] as $token) {
            if (str_starts_with($token, 'calc:')) {
                if (! preg_match('/^calc:([a-z0-9_.+*\/-]+)(?:\|decimal:([0-4]))?$/i', $token, $match)) {
                    $this->invalid('Calcul invalide : %'.$token.'%.');
                }
                $parts = preg_split('/([+*\/-])/', $match[1], -1, PREG_SPLIT_DELIM_CAPTURE);
                foreach ($parts as $index => $operand) {
                    if ($index % 2 === 1) {
                        continue;
                    }
                    if (preg_match('/^\d+(?:\.\d+)?$/', $operand)) {
                        continue;
                    }
                    if ($this->variableType($operand, $items, $fields) !== 'decimal') {
                        $this->invalid('Un calcul ne peut utiliser que des nombres.');
                    }
                }

                continue;
            }
            if (! preg_match('/^([a-z0-9_.]+)(?:\|(decimal:[0-4]|date:dmy|date:ymd))?$/', $token, $match)) {
                $this->invalid('Variable ou format invalide : %'.$token.'%.');
            }
            $type = $this->variableType($match[1], $items, $fields);
            if (isset($match[2]) && ! str_starts_with($match[2], $type.':')) {
                $this->invalid('Le format ne correspond pas au type de la variable.');
            }
            if ($match[1] === 'product.image' && $rule !== '%product.image%') {
                $this->invalid('Placez l’image seule dans sa cellule.');
            }
        }
    }

    private function variableType(string $name, bool $items, array &$fields): string
    {
        if ($name === 'export.date') {
            return 'date';
        }
        if ($name === 'export.count') {
            return 'decimal';
        }
        $key = str_starts_with($name, 'product.') ? substr($name, 8) : '';
        $key = $key === 'reference' ? 'ref' : $key;
        if (! $items || ! isset($this->metadata[$key])) {
            $this->invalid('Variable indisponible dans ce bloc : %'.$name.'%.');
        }
        $fields[] = $key;

        return $this->metadata[$key]['type'];
    }

    private function invalid(string $message): never
    {
        throw ValidationException::withMessages(['template' => $message]);
    }
}
