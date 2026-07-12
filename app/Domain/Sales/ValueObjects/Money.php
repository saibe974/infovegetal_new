<?php

declare(strict_types=1);

namespace App\Domain\Sales\ValueObjects;

use App\Domain\Sales\Exceptions\ArithmeticOverflowException;
use App\Domain\Sales\Exceptions\CurrencyMismatchException;

final readonly class Money
{
    public function __construct(
        public int $minorAmount,
        public Currency $currency,
    ) {
    }

    public static function zero(Currency $currency): self
    {
        return new self(0, $currency);
    }

    public function add(self $other): self
    {
        $this->assertSameCurrency($other);
        return new self(self::safeAdd($this->minorAmount, $other->minorAmount), $this->currency);
    }

    public function subtract(self $other): self
    {
        $this->assertSameCurrency($other);
        return new self(self::safeSub($this->minorAmount, $other->minorAmount), $this->currency);
    }

    public function isNegative(): bool
    {
        return $this->minorAmount < 0;
    }

    public function isZero(): bool
    {
        return $this->minorAmount === 0;
    }

    private function assertSameCurrency(self $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new CurrencyMismatchException('Cannot operate on different currencies.');
        }
    }

    private static function safeAdd(int $a, int $b): int
    {
        if (($b > 0 && $a > PHP_INT_MAX - $b) || ($b < 0 && $a < PHP_INT_MIN - $b)) {
            throw new ArithmeticOverflowException('Integer addition overflow.');
        }

        return $a + $b;
    }

    private static function safeSub(int $a, int $b): int
    {
        if (($b < 0 && $a > PHP_INT_MAX + $b) || ($b > 0 && $a < PHP_INT_MIN + $b)) {
            throw new ArithmeticOverflowException('Integer subtraction overflow.');
        }

        return $a - $b;
    }
}
