<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

final readonly class OrderTransportBreakdown
{
    public function __construct(
        public ?int $carrierId,
        public ?int $zoneId,
        public int $rollCount,
        public Money $tariffGrossHt,
        public Money $minimumAppliedHt,
        public Money $transportRealHt,
        public Money $transportEmbeddedInProductsHt,
        public Money $transportRemainingHt,
        public Money $transportChargedOnLinesHt,
        public Money $transportChargedAsOrderFeeHt,
        public Percentage $transportVatRate,
        public Money $transportVatTotal,
        public Money $transportTtc,
    ) {
    }
}
