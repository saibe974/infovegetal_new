<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class ShadowModeRolloutPlan
{
    /**
     * @param list<ShadowModeRolloutStep> $steps
     */
    public function __construct(
        public string $generatedAtUtc,
        public string $recommendedAction,
        public bool $approved,
        public int $currentBatchOrders,
        public array $steps,
    ) {
        foreach ($steps as $step) {
            if (!$step instanceof ShadowModeRolloutStep) {
                throw new \InvalidArgumentException('ShadowModeRolloutPlan steps must be ShadowModeRolloutStep instances.');
            }
        }
    }
}
