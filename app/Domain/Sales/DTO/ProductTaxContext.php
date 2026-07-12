<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\ValueObjects\Percentage;

final readonly class ProductTaxContext
{
    public function __construct(public Percentage $vatRate)
    {
    }
}
