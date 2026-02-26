<?php

namespace App\Casts;

use App\Support\CarrierDays;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;

class DaysMask implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes): ?array
    {
        if ($value === null) {
            return null;
        }

        $mask = is_numeric($value) ? (int) $value : 0;

        return CarrierDays::toList($mask) ?? [];
    }

    public function set($model, string $key, $value, array $attributes): ?int
    {
        if ($value === null) {
            return null;
        }

        if (is_array($value)) {
            return CarrierDays::fromList($value);
        }

        if (is_string($value) && str_contains($value, ',')) {
            $parts = array_filter(array_map('trim', explode(',', $value)), 'strlen');
            return CarrierDays::fromList($parts);
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return CarrierDays::fromList([(string) $value]);
    }
}
