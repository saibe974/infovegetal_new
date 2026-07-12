<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseExecutionPlanSerializer
{
    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionPlan $plan): array
    {
        $steps = [];
        foreach ($plan->steps as $step) {
            $steps[] = [
                'order' => $step->order,
                'title' => $step->title,
                'type' => $step->type,
                'mandatory' => $step->mandatory,
                'checks' => array_values($step->checks),
            ];
        }

        return [
            'generated_at_utc' => $plan->generatedAtUtc,
            'release_action' => $plan->releaseAction,
            'approved' => $plan->approved,
            'summary' => $plan->summary,
            'steps' => $steps,
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionPlan $plan): string
    {
        return (string) json_encode(
            $this->toArray($plan),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
