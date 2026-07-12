<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\ValueObjects\Money;

final readonly class CustomerInvoiceLineProjection
{
    public function __construct(
        public int $lineId,
        public Money $productHt,
        public Money $productVat,
        public Money $productTtc,
        public Money $transportHt,
        public Money $transportVat,
        public Money $transportTtc,
        public Money $totalHt,
        public Money $totalVat,
        public Money $totalTtc,
    ) {
    }
}
