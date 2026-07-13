<?php

use App\Support\RenderedTransportCalculator;

it('handles case A with full roll and carrier minimum gap', function () {
    $cost = RenderedTransportCalculator::calculateRenderedTransportCost([1.0], 150.0, 300.0);

    expect($cost)->toBe(150.0);
});

it('handles case B with one roll at 80 percent', function () {
    $cost = RenderedTransportCalculator::calculateRenderedTransportCost([0.8], 150.0, 300.0);

    expect($cost)->toBe(180.0);
});

it('handles case C with two full rolls', function () {
    $cost = RenderedTransportCalculator::calculateRenderedTransportCost([1.0, 1.0], 150.0, 300.0);

    expect($cost)->toBe(0.0);
});

it('handles case D with one full and one half roll', function () {
    $cost = RenderedTransportCalculator::calculateRenderedTransportCost([1.0, 0.5], 150.0, 300.0);

    expect($cost)->toBe(75.0);
});

it('handles case E with three rolls at 145', function () {
    $fullCost = RenderedTransportCalculator::calculateRenderedTransportCost([1.0, 1.0, 1.0], 145.0, 300.0);
    $partialCost = RenderedTransportCalculator::calculateRenderedTransportCost([1.0, 1.0, 0.8], 145.0, 300.0);

    expect($fullCost)->toBe(0.0)
        ->and($partialCost)->toBe(29.0);
});

/**
 * Business Rules:
 * BR-031
 */
it('returns zero rendered transport cost when no rolls are provided', function () {
    $cost = RenderedTransportCalculator::calculateRenderedTransportCost([], 150.0, 300.0);

    expect($cost)->toBe(0.0);
});
