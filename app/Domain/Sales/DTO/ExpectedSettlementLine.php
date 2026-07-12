<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\Enums\SettlementReason;
use App\Domain\Sales\Enums\TaxTreatmentStatus;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

final readonly class ExpectedSettlementLine
{
    public function __construct(
        public ActorType $fromActorType,
        public int $fromActorId,
        public ActorType $toActorType,
        public int $toActorId,
        public SettlementReason $reason,
        public Money $amountHt,
        public ?Percentage $vatRate,
        public ?Money $vatAmount,
        public TaxTreatmentStatus $taxTreatmentStatus,
    ) {
    }
}
