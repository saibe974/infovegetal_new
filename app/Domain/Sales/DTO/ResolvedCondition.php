<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\Enums\ApplicationScope;
use App\Domain\Sales\Enums\CalculationBaseType;
use App\Domain\Sales\Enums\ConditionType;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

final readonly class ResolvedCondition
{
    public function __construct(
        public string $id,
        public ConditionType $type,
        public ActorType $sourceActorType,
        public int $sourceActorId,
        public ApplicationScope $scope,
        public CalculationBaseType $baseType,
        public ?Percentage $percentageValue = null,
        public ?Money $moneyValue = null,
        public int $priority = 0,
    ) {
    }
}
