<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

final readonly class OrderTransportCalculationInput
{
    /**
     * @param list<\App\Domain\Sales\DTO\TransportLineInput> $lines
     */
    public function __construct(
        public TransportPresentationMode $presentationMode,
        public Money $tariffGrossHt,
        public Money $minimumAppliedHt,
        public Money $transportRealHt,
        public Percentage $transportVatRate,
        public array $lines,
        public ?int $carrierId = null,
        public ?int $zoneId = null,
        public int $rollCount = 0,
    ) {
        foreach ($lines as $line) {
            if (!$line instanceof \App\Domain\Sales\DTO\TransportLineInput) {
                throw new \InvalidArgumentException('OrderTransportCalculationInput lines must be TransportLineInput instances.');
            }
        }
    }
}
