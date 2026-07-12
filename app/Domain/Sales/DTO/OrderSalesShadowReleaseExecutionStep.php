<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseExecutionStep
{
    /**
     * @param list<string> $checks
     */
    public function __construct(
        public int $order,
        public string $title,
        public string $type,
        public bool $mandatory,
        public array $checks,
    ) {
    }
}
