<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseExecutionPackageVerifier
{
    /**
     * @return object
     */
    public function verify(\App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionPackage $package)
    {
        $errors = [];

        $pipelineDecoded = json_decode($package->pipelineJson, true);
        if (!is_array($pipelineDecoded)) {
            $errors[] = 'pipelineJson is not valid JSON object/array.';
        } elseif ($pipelineDecoded !== $package->pipelineArray) {
            $errors[] = 'pipelineArray does not match decoded pipelineJson.';
        }

        $executionDecoded = json_decode($package->executionPlanJson, true);
        if (!is_array($executionDecoded)) {
            $errors[] = 'executionPlanJson is not valid JSON object/array.';
        } elseif ($executionDecoded !== $package->executionPlanArray) {
            $errors[] = 'executionPlanArray does not match decoded executionPlanJson.';
        }

        $pipelineAction = $package->pipelineResult->releaseDecision->action;
        $executionAction = $package->executionPlan->releaseAction;
        if ($pipelineAction !== $executionAction) {
            $errors[] = 'release action mismatch between pipelineResult and executionPlan.';
        }

        $pipelineArrayAction = $package->pipelineArray['release_decision']['action'] ?? null;
        $executionArrayAction = $package->executionPlanArray['release_action'] ?? null;
        if (!is_string($pipelineArrayAction) || !is_string($executionArrayAction) || $pipelineArrayAction !== $executionArrayAction) {
            $errors[] = 'release action mismatch between serialized payloads.';
        }

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseExecutionPackageVerification';

        return new $resultClass(
            isValid: count($errors) === 0,
            errors: $errors,
        );
    }
}
