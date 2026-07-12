<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseReadinessRunner
{
    public function __construct(
        private readonly OrderSalesShadowReleaseExecutionPackageBuilder $executionPackageBuilder = new OrderSalesShadowReleaseExecutionPackageBuilder(),
        private readonly OrderSalesShadowReleaseExecutionPackageVerifier $executionPackageVerifier = new OrderSalesShadowReleaseExecutionPackageVerifier(),
        private readonly OrderSalesShadowReleaseReadinessReportBuilder $readinessReportBuilder = new OrderSalesShadowReleaseReadinessReportBuilder(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowReleaseReadinessInput $input)
    {
        $executionPackage = $this->executionPackageBuilder->build(
            pipelineInput: $input->pipelineInput,
            executionPlanGeneratedAtUtc: $input->executionPlanGeneratedAtUtc,
            packageGeneratedAtUtc: $input->executionPackageGeneratedAtUtc,
        );

        $verification = $this->executionPackageVerifier->verify($executionPackage);
        $report = $this->readinessReportBuilder->build($executionPackage, $verification, $input->readinessGeneratedAtUtc);

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseReadinessResult';

        return new $resultClass(
            executionPackage: $executionPackage,
            executionPackageVerification: $verification,
            readinessReport: $report,
        );
    }
}
