<?php

declare(strict_types=1);

use App\Domain\Sales\Services\TransportRenderedPricingService;

/**
 * Business Rules:
 * BR-030
 */
it('calculates the rendered transport cost from fill rates and carrier minimum', function (): void {
    $service = new TransportRenderedPricingService();

    expect($service->calculate([1.0, 0.5], 150.0, 300.0))->toBe(75.0)
        ->and($service->calculate([0.8], 150.0, 300.0))->toBe(180.0);
});

/**
 * Business Rules:
 * BR-030
 */
it('returns zero rendered transport cost when no rolls are provided', function (): void {
    $service = new TransportRenderedPricingService();

    expect($service->calculate([], 150.0, 300.0))->toBe(0.0);
});