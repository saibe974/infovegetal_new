<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseReadinessReportBuilder
{
    /**
     * @return object
     */
    public function build(
        \App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionPackage $package,
        \App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionPackageVerification $verification,
        string $generatedAtUtc,
    ) {
        $releaseAction = $package->pipelineResult->releaseDecision->action;
        $blockingIssues = [];
        $warnings = [];

        if (!$verification->isValid) {
            foreach ($verification->errors as $error) {
                $blockingIssues[] = (string) $error;
            }
        }

        if ($releaseAction === 'reject_release') {
            foreach ($package->pipelineResult->releaseDecision->reasons as $reason) {
                $blockingIssues[] = (string) $reason;
            }
        }

        if ($releaseAction === 'hold_release') {
            foreach ($package->pipelineResult->releaseDecision->reasons as $reason) {
                $warnings[] = (string) $reason;
            }
        }

        $requiredSteps = 0;
        $remediationSteps = 0;
        foreach ($package->executionPlan->steps as $step) {
            if ($step->mandatory) {
                $requiredSteps++;
            }
            if ($step->type === 'remediation') {
                $remediationSteps++;
            }
        }

        $status = 'ready';
        if (count($blockingIssues) > 0) {
            $status = 'blocked';
        } elseif ($releaseAction === 'hold_release') {
            $status = 'hold';
        }

        $reportClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseReadinessReport';

        return new $reportClass(
            generatedAtUtc: $generatedAtUtc,
            status: $status,
            releaseAction: $releaseAction,
            integrityValid: $verification->isValid,
            requiredSteps: $requiredSteps,
            remediationSteps: $remediationSteps,
            blockingIssues: array_values(array_unique($blockingIssues)),
            warnings: array_values(array_unique($warnings)),
        );
    }
}
