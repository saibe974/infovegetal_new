<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseReadinessResultSerializer
{
    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseReadinessResult $result): array
    {
        return [
            'execution_package' => [
                'generated_at_utc' => $result->executionPackage->generatedAtUtc,
                'release_action' => $result->executionPackage->pipelineResult->releaseDecision->action,
                'approved' => $result->executionPackage->pipelineResult->releaseDecision->approved,
            ],
            'execution_package_verification' => [
                'is_valid' => $result->executionPackageVerification->isValid,
                'errors' => array_values($result->executionPackageVerification->errors),
            ],
            'readiness_report' => [
                'generated_at_utc' => $result->readinessReport->generatedAtUtc,
                'status' => $result->readinessReport->status,
                'release_action' => $result->readinessReport->releaseAction,
                'approved' => $result->readinessReport->status === 'ready',
                'integrity_valid' => $result->readinessReport->integrityValid,
                'required_steps' => $result->readinessReport->requiredSteps,
                'remediation_steps' => $result->readinessReport->remediationSteps,
                'blocking_issues' => array_values($result->readinessReport->blockingIssues),
                'warnings' => array_values($result->readinessReport->warnings),
            ],
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseReadinessResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
