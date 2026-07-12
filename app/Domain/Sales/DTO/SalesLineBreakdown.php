<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class SalesLineBreakdown
{
    /**
     * @param list<CalculationOperation> $operations
     * @param list<ActorEarningBreakdown> $actorEarnings
     * @param list<CalculationWarning> $warnings
     */
    public function __construct(
        public int $lineId,
        public ProductPriceReference $priceReference,
        public ProductComponentBreakdown $product,
        public array $operations,
        public array $actorEarnings,
        public array $warnings,
    ) {
        foreach ($operations as $operation) {
            if (!$operation instanceof CalculationOperation) {
                throw new \InvalidArgumentException('SalesLineBreakdown operations must be CalculationOperation instances.');
            }
        }

        foreach ($actorEarnings as $earning) {
            if (!$earning instanceof ActorEarningBreakdown) {
                throw new \InvalidArgumentException('SalesLineBreakdown actorEarnings must be ActorEarningBreakdown instances.');
            }
        }

        foreach ($warnings as $warning) {
            if (!$warning instanceof CalculationWarning) {
                throw new \InvalidArgumentException('SalesLineBreakdown warnings must be CalculationWarning instances.');
            }
        }
    }
}
