<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class ShadowModeGateDecision
{
    /**
     * @param list<string> $reasons
     */
    public function __construct(
        public mixed $action,
        public bool $approved,
        public array $reasons,
    ) {
    }
}
