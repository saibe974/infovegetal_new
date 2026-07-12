<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleasePipelineResultSerializer
{
    public function __construct(
        private readonly OrderSalesShadowGovernanceResultSerializer $governanceSerializer = new OrderSalesShadowGovernanceResultSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleasePipelineResult $result): array
    {
        $governance = $this->governanceSerializer->toArray($result->envelope->package->governanceResult);

        return [
            'envelope' => [
                'generated_at_utc' => $result->envelope->generatedAtUtc,
                'checksum_algorithm' => $result->envelope->checksumAlgorithm,
                'checksum' => $result->envelope->checksum,
                'package_generated_at_utc' => $result->envelope->package->generatedAtUtc,
            ],
            'verification' => [
                'is_valid' => $result->verification->isValid,
                'expected_checksum' => $result->verification->expectedChecksum,
                'actual_checksum' => $result->verification->actualChecksum,
                'algorithm' => $result->verification->algorithm,
                'errors' => array_values($result->verification->errors),
            ],
            'release_decision' => [
                'action' => $result->releaseDecision->action,
                'approved' => $result->releaseDecision->approved,
                'integrity_verified' => $result->releaseDecision->integrityVerified,
                'rollout_action' => $result->releaseDecision->rolloutAction,
                'reasons' => array_values($result->releaseDecision->reasons),
            ],
            'governance' => $governance,
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleasePipelineResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
