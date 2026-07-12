<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\ValueObjects\Money;

final readonly class TransportPreparationResult
{
    public function __construct(
        public TransportPresentationMode $presentationMode,
        public Money $transportAdditionalFeeHt,
        public Money $transportEmbeddedInProductsHt,
        public bool $hasAdditionalTransportFee,
    ) {
    }
}
