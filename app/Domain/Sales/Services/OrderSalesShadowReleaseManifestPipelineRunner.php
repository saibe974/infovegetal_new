<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPipelineRunner
{
    public function __construct(
        private readonly OrderSalesShadowReleaseReadinessRunner $readinessRunner = new OrderSalesShadowReleaseReadinessRunner(),
        private readonly OrderSalesShadowReleaseManifestBuilder $manifestBuilder = new OrderSalesShadowReleaseManifestBuilder(),
        private readonly OrderSalesShadowReleaseManifestVerifier $manifestVerifier = new OrderSalesShadowReleaseManifestVerifier(),
    ) {
    }

    /**
     * @return object
     */
    public function run(object $input): object
    {
        if (!is_a($input, 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPipelineInput')) {
            throw new \InvalidArgumentException('Input must be OrderSalesShadowReleaseManifestPipelineInput.');
        }

        $readinessResult = $this->readinessRunner->run($input->readinessInput);

        $manifest = $this->manifestBuilder->build(
            result: $readinessResult,
            generatedAtUtc: $input->manifestGeneratedAtUtc,
            schemaVersion: $input->schemaVersion,
        );

        $manifestVerification = $this->manifestVerifier->verify($manifest);

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPipelineResult';

        return new $resultClass(
            readinessResult: $readinessResult,
            manifest: $manifest,
            manifestVerification: $manifestVerification,
        );
    }
}
