<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\CalculationBaseType;
use App\Domain\Sales\ValueObjects\Money;

final readonly class CalculationOperation
{
    public function __construct(
        public string $operationType,
        public ?string $sourceConditionId,
        public CalculationBaseType $baseType,
        public Money $inputAmount,
        public Money $calculatedAmount,
        public Money $outputAmount,
        public string $formulaId,
    ) {
    }
}
