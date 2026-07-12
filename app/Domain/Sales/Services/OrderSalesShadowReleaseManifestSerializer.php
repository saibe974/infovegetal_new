<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestSerializer
{
    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifest $manifest): array
    {
        return [
            'generated_at_utc' => $manifest->generatedAtUtc,
            'schema_version' => $manifest->schemaVersion,
            'manifest_id' => $manifest->manifestId,
            'status' => $manifest->status,
            'release_action' => $manifest->releaseAction,
            'approved' => $manifest->approved,
            'integrity_valid' => $manifest->integrityValid,
            'required_steps' => $manifest->requiredSteps,
            'remediation_steps' => $manifest->remediationSteps,
            'payload' => $manifest->payload,
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifest $manifest): string
    {
        return (string) json_encode(
            $this->toArray($manifest),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
