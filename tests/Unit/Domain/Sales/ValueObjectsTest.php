<?php

declare(strict_types=1);

use App\Domain\Sales\Exceptions\ArithmeticOverflowException;
use App\Domain\Sales\Exceptions\InvalidQuantityException;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;
use App\Domain\Sales\ValueObjects\PreciseAmount;
use App\Domain\Sales\ValueObjects\Quantity;

it('adds money with same currency', function () {
    $a = new Money(1000, Currency::EUR);
    $b = new Money(250, Currency::EUR);

    expect($a->add($b)->minorAmount)->toBe(1250);
});

it('rejects addition with different currencies', function () {
    $a = new Money(1000, Currency::EUR);
    $b = new Money(1000, Currency::USD);

    expect(fn () => $a->add($b))->toThrow(\App\Domain\Sales\Exceptions\CurrencyMismatchException::class);
});

it('parses percentage 5.5 percent as 550 basis points', function () {
    $p = Percentage::fromString('5.5');

    expect($p->basisPoints)->toBe(550);
});

it('applies half-up rounding from precise amount to money', function () {
    $amount = new PreciseAmount(2_375_000, Currency::EUR); // 2.375 EUR
    $money = $amount->toMoney();

    expect($money->minorAmount)->toBe(238);
});

it('allows negative money amounts for supported operations', function () {
    $negative = new Money(-500, Currency::EUR);

    expect($negative->minorAmount)->toBe(-500)
        ->and($negative->isNegative())->toBeTrue();
});

it('detects multiplication overflow in precise amount', function () {
    $huge = new PreciseAmount(PHP_INT_MAX, Currency::EUR);
    $quantity = Quantity::fromInt(2);

    $closure = fn () => $huge->multiplyByQuantity($quantity);

    expect($closure)->toThrow(ArithmeticOverflowException::class);
});

it('accepts integer and decimal quantities including half unit', function () {
    expect(Quantity::fromInt(2)->rawAmount)->toBe(2_000_000)
        ->and(Quantity::fromString('1.5')->rawAmount)->toBe(1_500_000)
        ->and(Quantity::fromString('0.5')->rawAmount)->toBe(500_000);
});

it('rejects zero and negative quantity', function () {
    expect(fn () => Quantity::fromString('0'))->toThrow(InvalidQuantityException::class)
        ->and(fn () => Quantity::fromString('-1'))->toThrow(InvalidQuantityException::class);
});
