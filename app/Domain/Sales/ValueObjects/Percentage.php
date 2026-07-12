<?php

declare(strict_types=1);

namespace App\Domain\Sales\ValueObjects;

use App\Domain\Sales\Exceptions\InvalidPercentageException;

final readonly class Percentage
{
    public function __construct(public int $basisPoints)
    {
        if ($basisPoints < -1_000_000 || $basisPoints > 1_000_000) {
            throw new InvalidPercentageException('Percentage basis points out of supported range.');
        }
    }

    public static function fromString(string $value): self
    {
        $normalized = str_replace(',', '.', trim($value));
        if (!preg_match('/^-?\d+(?:\.\d{1,4})?$/', $normalized)) {
            throw new InvalidPercentageException('Invalid percentage decimal format.');
        }

        $negative = str_starts_with($normalized, '-');
        $unsigned = ltrim($normalized, '-');
        [$intPart, $fracPart] = array_pad(explode('.', $unsigned, 2), 2, '0');
        $fracPart = str_pad(substr($fracPart, 0, 4), 4, '0');

        // percent decimal -> basis points (2 decimals) with half-up rounding from 4 decimals.
        $scaled = ((int) $intPart) * 10_000 + (int) $fracPart;
        $bps = intdiv($scaled + 50, 100);

        return new self($negative ? -$bps : $bps);
    }
}
