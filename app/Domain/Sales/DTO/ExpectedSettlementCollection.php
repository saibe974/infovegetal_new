<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class ExpectedSettlementCollection
{
    /**
     * @param list<\App\Domain\Sales\DTO\ExpectedSettlementLine> $lines
     */
    public function __construct(public array $lines)
    {
        foreach ($lines as $line) {
            if (!is_a($line, 'App\\Domain\\Sales\\DTO\\ExpectedSettlementLine')) {
                throw new \InvalidArgumentException('ExpectedSettlementCollection lines must be ExpectedSettlementLine instances.');
            }
        }
    }
}
