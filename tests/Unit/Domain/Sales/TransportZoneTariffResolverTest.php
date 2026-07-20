<?php

declare(strict_types=1);

use App\Domain\Sales\Services\TransportZoneTariffResolver;

/**
 * Business Rules:
 * BR-029
 * BR-035
 */
it('resolves the matching zone tariff for the roll count', function (): void {
    $resolver = new TransportZoneTariffResolver();

    $tariffs = [
        'mini' => 120,
        'roll:1-3' => 150,
        'roll:4-6' => 110,
    ];

    expect($resolver->resolve(2, $tariffs))->toBe(150.0)
        ->and($resolver->resolve(5, $tariffs))->toBe(110.0);
});

/**
 * Business Rules:
 * BR-029
 * BR-035
 */
it('returns zero when no tariff matches the roll count', function (): void {
    $resolver = new TransportZoneTariffResolver();

    $tariffs = [
        'mini' => 120,
        'roll:4-6' => 110,
    ];

    expect($resolver->resolve(1, $tariffs))->toBe(0.0)
        ->and($resolver->resolve(0, $tariffs))->toBe(0.0);
});