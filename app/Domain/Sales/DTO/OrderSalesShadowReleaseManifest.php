<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifest
{
    public function __construct(
        public string $generatedAtUtc,
        public string $schemaVersion,
        public string $manifestId,
        public string $status,
        public string $releaseAction,
        public bool $approved,
        public bool $integrityValid,
        public int $requiredSteps,
        public int $remediationSteps,
        public array $payload,
    ) {
    }
}
