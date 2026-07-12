<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseExecutionPlan
{
    /**
     * @param list<OrderSalesShadowReleaseExecutionStep> $steps
     */
    public function __construct(
        public string $generatedAtUtc,
        public string $releaseAction,
        public bool $approved,
        public string $summary,
        public array $steps,
    ) {
        foreach ($steps as $step) {
            if (!is_a($step, 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseExecutionStep')) {
                throw new \InvalidArgumentException('OrderSalesShadowReleaseExecutionPlan steps must be OrderSalesShadowReleaseExecutionStep instances.');
            }
        }
    }
}
