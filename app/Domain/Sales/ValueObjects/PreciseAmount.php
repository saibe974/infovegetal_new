<?php

declare(strict_types=1);

namespace App\Domain\Sales\ValueObjects;

use App\Domain\Sales\Enums\RoundingRule;
use App\Domain\Sales\Exceptions\ArithmeticOverflowException;

final readonly class PreciseAmount
{
    public const SCALE = 1_000_000; // 1.000000 EUR
    private const MONEY_DIVISOR = 10_000; // 1 cent = 10_000 precise units

    public function __construct(public int $rawAmount, public Currency $currency)
    {
    }

    public static function zero(Currency $currency): self
    {
        return new self(0, $currency);
    }

    public static function fromMoney(Money $money): self
    {
        return new self(self::safeMul($money->minorAmount, self::MONEY_DIVISOR), $money->currency);
    }

    public function toMoney(RoundingRule $rule = RoundingRule::LineHalfUpV1): Money
    {
        if ($rule !== RoundingRule::LineHalfUpV1) {
            // Single rule implemented in lot 1.
        }

        return new Money(self::divRoundHalfUp($this->rawAmount, self::MONEY_DIVISOR), $this->currency);
    }

    public function add(self $other): self
    {
        $this->assertSameCurrency($other);
        return new self(self::safeAdd($this->rawAmount, $other->rawAmount), $this->currency);
    }

    public function subtract(self $other): self
    {
        $this->assertSameCurrency($other);
        return new self(self::safeSub($this->rawAmount, $other->rawAmount), $this->currency);
    }

    public function multiplyByPercentage(Percentage $percentage): self
    {
        $num = self::safeMul($this->rawAmount, $percentage->basisPoints);
        return new self(self::divRoundHalfUp($num, 10_000), $this->currency);
    }

    public function multiplyByQuantity(Quantity $quantity): self
    {
        $num = self::safeMul($this->rawAmount, $quantity->rawAmount);
        return new self(self::divRoundHalfUp($num, Quantity::SCALE), $this->currency);
    }

    public function isNegative(): bool
    {
        return $this->rawAmount < 0;
    }

    public function isZero(): bool
    {
        return $this->rawAmount === 0;
    }

    private function assertSameCurrency(self $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new ArithmeticOverflowException('Currency mismatch in precise arithmetic.');
        }
    }

    private static function safeMul(int $a, int $b): int
    {
        if ($a === 0 || $b === 0) {
            return 0;
        }

        if ($a === -1 && $b === PHP_INT_MIN) {
            throw new ArithmeticOverflowException('Integer multiplication overflow.');
        }

        if ($b === -1 && $a === PHP_INT_MIN) {
            throw new ArithmeticOverflowException('Integer multiplication overflow.');
        }

        $absA = abs($a);
        $absB = abs($b);

        if ($absA > intdiv(PHP_INT_MAX, $absB)) {
            throw new ArithmeticOverflowException('Integer multiplication overflow.');
        }

        return $a * $b;
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

    private static function divRoundHalfUp(int $num, int $den): int
    {
        if ($den <= 0) {
            throw new ArithmeticOverflowException('Invalid division denominator.');
        }

        if ($num >= 0) {
            return intdiv($num + intdiv($den, 2), $den);
        }

        return -intdiv(abs($num) + intdiv($den, 2), $den);
    }
}
