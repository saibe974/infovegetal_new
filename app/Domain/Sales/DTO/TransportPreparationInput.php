<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\ValueObjects\Money;

final readonly class TransportPreparationInput
{
    /**
     * @param list<int> $lineIds
     */
    public function __construct(
        public TransportPresentationMode $presentationMode,
        public Money $transportRealHt,
        public Money $transportEmbeddedInProductsHt,
        public array $lineIds,
    ) {
    }
}
