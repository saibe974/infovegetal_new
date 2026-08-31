<?php

namespace App\Services;

use Carbon\Carbon;

/** Safe rule evaluator shared by billing documents and catalogue exports. */
class FileRuleRenderer
{
    public function render(string $value, array $variables, bool $emptyInvalidCalculations = false): string
    {
        $value = (string) preg_replace_callback(
            '/%calc:[^%]+%/i',
            fn ($matches) => $this->evaluateCalculation($matches[0], $variables) ?? ($emptyInvalidCalculations ? '' : $matches[0]),
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

        if (! is_finite($result)) {
            return null;
        }

        return isset($matches[2])
            ? number_format($result, (int) $matches[2], '.', '')
            : (string) $result;
    }

    private function formatVariable(string $value, ?string $format): string
    {
        if ($format === null || $format === '' || trim($value) === '') {
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
}
