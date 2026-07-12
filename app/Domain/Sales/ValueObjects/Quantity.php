<?php

declare(strict_types=1);

namespace App\Domain\Sales\ValueObjects;

use App\Domain\Sales\Exceptions\InvalidQuantityException;

final readonly class Quantity
{
    public const SCALE = 1_000_000; // 1 unit = 1_000_000 micros

    public function __construct(public int $rawAmount)
    {
        if ($rawAmount <= 0) {
            throw new InvalidQuantityException('Quantity must be strictly positive.');
        }
    }

    public static function fromInt(int $value): self
    {
        if ($value <= 0) {
            throw new InvalidQuantityException('Quantity must be strictly positive.');
        }

        return new self($value * self::SCALE);
    }

    public static function fromString(string $value): self
    {
        $normalized = str_replace(',', '.', trim($value));
        if (!preg_match('/^\d+(?:\.\d{1,6})?$/', $normalized)) {
            throw new InvalidQuantityException('Invalid quantity decimal format.');
        }

        [$intPart, $fracPart] = array_pad(explode('.', $normalized, 2), 2, '0');
        $fracPart = str_pad(substr($fracPart, 0, 6), 6, '0');

        $raw = ((int) $intPart) * self::SCALE + (int) $fracPart;

        return new self($raw);
    }
}
