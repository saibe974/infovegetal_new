<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowGovernanceReleaseDecision
{
    /**
     * @param list<string> $reasons
     */
    public function __construct(
        public string $action,
        public bool $approved,
        public bool $integrityVerified,
        public string $rolloutAction,
        public array $reasons,
    ) {
    }
}
