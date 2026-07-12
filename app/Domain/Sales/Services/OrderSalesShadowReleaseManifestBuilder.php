<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestBuilder
{
    public function __construct(
        private readonly OrderSalesShadowReleaseReadinessResultSerializer $serializer = new OrderSalesShadowReleaseReadinessResultSerializer(),
    ) {
    }

    /**
     * @return object
     */
    public function build(
        \App\Domain\Sales\DTO\OrderSalesShadowReleaseReadinessResult $result,
        string $generatedAtUtc,
        string $schemaVersion = '1.0',
    ) {
        $payload = $this->serializer->toArray($result);

        $canonical = [
            'schema_version' => $schemaVersion,
            'payload' => $payload,
        ];

        $manifestId = hash(
            'sha256',
            (string) json_encode($canonical, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );

        $report = $result->readinessReport;
        $manifestClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifest';

        return new $manifestClass(
            generatedAtUtc: $generatedAtUtc,
            schemaVersion: $schemaVersion,
            manifestId: $manifestId,
            status: $report->status,
            releaseAction: $report->releaseAction,
            approved: $report->status === 'ready',
            integrityValid: $report->integrityValid,
            requiredSteps: $report->requiredSteps,
            remediationSteps: $report->remediationSteps,
            payload: $payload,
        );
    }
}
