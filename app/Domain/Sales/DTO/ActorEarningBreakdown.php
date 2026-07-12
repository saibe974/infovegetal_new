<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\ValueObjects\Money;

final readonly class ActorEarningBreakdown
{
    public function __construct(
        public ActorType $actorType,
        public int $actorId,
        public Money $grossMarginHt,
        public Money $discountSupportedHt,
        public Money $netEarningHt,
    ) {
    }
}
