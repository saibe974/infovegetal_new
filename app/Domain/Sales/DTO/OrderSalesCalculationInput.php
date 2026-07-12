<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesCalculationInput
{
    /**
     * @param list<LineCalculationInput> $lineInputs
     */
    public function __construct(
        public array $lineInputs,
        public OrderTransportCalculationInput $transportInput,
        public array $inputContext,
        public string $generatedAtUtc,
        public ?LegacyOrderReference $legacyReference = null,
        public int $comparisonToleranceMinor = 0,
    ) {
        foreach ($lineInputs as $lineInput) {
            if (!$lineInput instanceof LineCalculationInput) {
                throw new \InvalidArgumentException('OrderSalesCalculationInput lineInputs must be LineCalculationInput instances.');
            }
        }
    }
}
