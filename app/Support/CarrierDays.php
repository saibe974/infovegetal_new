<?php

namespace App\Support;

final class CarrierDays
{
    public const DAY_MASKS = [
        '1' => 1,
        '2' => 2,
        '3' => 4,
        '4' => 8,
        '5' => 16,
        '6' => 32,
        '7' => 64,
    ];

    /**
     * @param array<int, string|int> $days
     */
    public static function fromList(?array $days): ?int
    {
        if ($days === null) {
            return null;
        }

        $mask = 0;

        foreach ($days as $day) {
            $key = (string) $day;
            if (isset(self::DAY_MASKS[$key])) {
                $mask |= self::DAY_MASKS[$key];
            }
        }

        return $mask;
    }

    /**
     * @return array<int, string>|null
     */
    public static function toList(?int $mask): ?array
    {
        if ($mask === null) {
            return null;
        }

        $days = [];

        foreach (self::DAY_MASKS as $day => $bit) {
            if (($mask & $bit) === $bit) {
                $days[] = $day;
            }
        }

        return $days;
    }
}
