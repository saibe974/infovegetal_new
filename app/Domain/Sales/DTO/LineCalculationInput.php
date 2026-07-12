<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\SalesMode;
use App\Domain\Sales\ValueObjects\Quantity;

final readonly class LineCalculationInput
{
    public function __construct(
        public int $lineId,
        public ProductPriceReference $priceReference,
        public Quantity $quantity,
        public ActorChain $actorChain,
        public ResolvedConditionCollection $conditions,
        public ProductTaxContext $taxContext,
        public SalesMode $salesMode,
    ) {
    }
}
