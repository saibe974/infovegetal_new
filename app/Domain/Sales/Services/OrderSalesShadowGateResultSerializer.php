<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowGateResultSerializer
{
    public function __construct(
        private readonly ShadowModeBatchReportSerializer $batchReportSerializer = new ShadowModeBatchReportSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowGateResult $result): array
    {
        $batch = $this->batchReportSerializer->toArray($result->batchResult->report);

        return [
            'gate_decision' => [
                'action' => is_object($result->gateDecision->action)
                    ? $result->gateDecision->action->value
                    : (string) $result->gateDecision->action,
                'approved' => $result->gateDecision->approved,
                'reasons' => array_values($result->gateDecision->reasons),
            ],
            'batch_report' => $batch,
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowGateResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
