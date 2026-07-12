<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseReadinessReport
{
    /**
     * @param list<string> $blockingIssues
     * @param list<string> $warnings
     */
    public function __construct(
        public string $generatedAtUtc,
        public string $status,
        public string $releaseAction,
        public bool $integrityValid,
        public int $requiredSteps,
        public int $remediationSteps,
        public array $blockingIssues,
        public array $warnings,
    ) {
    }
}
