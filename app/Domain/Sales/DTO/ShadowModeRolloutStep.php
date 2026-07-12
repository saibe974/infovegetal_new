<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class ShadowModeRolloutStep
{
    /**
     * @param list<string> $notes
     */
    public function __construct(
        public string $phase,
        public int $trafficPercent,
        public int $durationHours,
        public string $action,
        public bool $requiresManualValidation,
        public array $notes,
    ) {
        if ($trafficPercent < 0 || $trafficPercent > 100) {
            throw new \InvalidArgumentException('ShadowModeRolloutStep trafficPercent must be between 0 and 100.');
        }

        if ($durationHours < 0) {
            throw new \InvalidArgumentException('ShadowModeRolloutStep durationHours must be >= 0.');
        }
    }
}
