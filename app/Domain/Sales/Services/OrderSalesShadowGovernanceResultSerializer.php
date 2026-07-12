<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowGovernanceResultSerializer
{
    public function __construct(
        private readonly OrderSalesShadowGateResultSerializer $gateResultSerializer = new OrderSalesShadowGateResultSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowGovernanceResult $result): array
    {
        $gate = $this->gateResultSerializer->toArray($result->gateResult);

        $steps = [];
        foreach ($result->rolloutPlan->steps as $step) {
            $steps[] = [
                'phase' => $step->phase,
                'traffic_percent' => $step->trafficPercent,
                'duration_hours' => $step->durationHours,
                'action' => $step->action,
                'requires_manual_validation' => $step->requiresManualValidation,
                'notes' => array_values($step->notes),
            ];
        }

        return [
            'gate' => $gate,
            'rollout_plan' => [
                'generated_at_utc' => $result->rolloutPlan->generatedAtUtc,
                'recommended_action' => $result->rolloutPlan->recommendedAction,
                'approved' => $result->rolloutPlan->approved,
                'current_batch_orders' => $result->rolloutPlan->currentBatchOrders,
                'steps' => $steps,
            ],
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowGovernanceResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
