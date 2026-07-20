<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class TransportZoneTariffResolver
{
    public function resolve(int $rollCount, array $tariffs): float
    {
        if ($rollCount <= 0) {
            return 0.0;
        }

        $entries = [];
        foreach ($tariffs as $key => $value) {
            if ((string) $key === 'mini') {
                continue;
            }

            $range = $this->parseTariffRange((string) $key);
            if ($range === null) {
                continue;
            }

            $numValue = $this->tariffToFloat($value);
            if (!is_finite($numValue) || $numValue <= 0 || $range['min'] <= 0) {
                continue;
            }

            $entries[] = ['min' => $range['min'], 'max' => $range['max'], 'value' => $numValue];
        }

        usort($entries, fn (array $a, array $b): int => $a['min'] !== $b['min']
            ? $a['min'] <=> $b['min']
            : ($a['max'] ?? PHP_INT_MAX) <=> ($b['max'] ?? PHP_INT_MAX));

        if (empty($entries)) {
            return 0.0;
        }

        $eligible = array_values(array_filter(
            $entries,
            fn (array $entry): bool => $rollCount >= $entry['min'] && ($entry['max'] === null || $rollCount <= $entry['max'])
        ));

        if (!empty($eligible)) {
            return array_reduce($eligible, fn (array $best, array $entry): array => $entry['min'] >= $best['min'] ? $entry : $best, $eligible[0])['value'];
        }

        $lowerOrEqual = array_values(array_filter($entries, fn (array $entry): bool => $rollCount >= $entry['min']));

        return !empty($lowerOrEqual) ? end($lowerOrEqual)['value'] : 0.0;
    }

    private function parseTariffRange(string $key): ?array
    {
        $normalized = trim((string) preg_replace('/^roll:/', '', trim($key)));
        if ($normalized === '') {
            return null;
        }

        preg_match_all('/\d+(?:[.,]\d+)?/', $normalized, $matches);
        $parts = $matches[0] ?? [];
        if (empty($parts)) {
            return null;
        }

        $toVal = fn (string $value): float => (float) str_replace(',', '.', $value);
        $min = $toVal($parts[0]);
        if (!is_finite($min)) {
            return null;
        }

        $max = isset($parts[1]) ? (is_finite($toVal($parts[1])) ? $toVal($parts[1]) : null) : null;

        return ['min' => $min, 'max' => $max];
    }

    private function tariffToFloat(mixed $value): float
    {
        if (is_float($value)) {
            return is_finite($value) ? $value : 0.0;
        }

        if (is_int($value)) {
            return (float) $value;
        }

        if (is_string($value)) {
            $parsed = (float) str_replace(',', '.', trim($value));
            return is_finite($parsed) ? $parsed : 0.0;
        }

        return 0.0;
    }
}