<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\SalesCalculationWarningCode;

final readonly class CalculationWarning
{
    public function __construct(
        public SalesCalculationWarningCode $code,
        public string $message,
    ) {
    }
}
