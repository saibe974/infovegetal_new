<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\ValueObjects\Money;

final readonly class CustomerInvoiceProjection
{
    /**
    * @param list<\App\Domain\Sales\DTO\CustomerInvoiceLineProjection> $lines
     */
    public function __construct(
        public array $lines,
        public Money $productsHt,
        public Money $productsVat,
        public Money $productsTtc,
        public Money $transportHt,
        public Money $transportVat,
        public Money $transportTtc,
        public Money $transportOrderFeeHt,
        public Money $transportOrderFeeVat,
        public Money $transportOrderFeeTtc,
        public Money $totalHt,
        public Money $totalVat,
        public Money $totalTtc,
    ) {
        foreach ($lines as $line) {
            if (!$line instanceof \App\Domain\Sales\DTO\CustomerInvoiceLineProjection) {
                throw new \InvalidArgumentException('CustomerInvoiceProjection lines must be CustomerInvoiceLineProjection instances.');
            }
        }
    }
}
