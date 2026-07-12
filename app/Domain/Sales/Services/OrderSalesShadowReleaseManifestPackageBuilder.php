<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPackageBuilder
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPipelineRunner $pipelineRunner = new OrderSalesShadowReleaseManifestPipelineRunner(),
        private readonly OrderSalesShadowReleaseManifestPipelineResultSerializer $pipelineSerializer = new OrderSalesShadowReleaseManifestPipelineResultSerializer(),
    ) {
    }

    /**
     * @return object
     */
    public function build(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageInput $input)
    {
        if ($input->checksumAlgorithm !== 'sha256') {
            throw new \InvalidArgumentException('Unsupported checksum algorithm: ' . $input->checksumAlgorithm);
        }

        $pipelineResult = $this->pipelineRunner->run($input->manifestPipelineInput);
        $pipelineArray = $this->pipelineSerializer->toArray($pipelineResult);
        $pipelineJson = $this->pipelineSerializer->toJson($pipelineResult);

        $checksum = hash($input->checksumAlgorithm, $pipelineJson);

        $packageClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPackage';

        return new $packageClass(
            generatedAtUtc: $input->packageGeneratedAtUtc,
            checksumAlgorithm: $input->checksumAlgorithm,
            checksum: $checksum,
            manifestPipelineResult: $pipelineResult,
            manifestPipelineArray: $pipelineArray,
            manifestPipelineJson: $pipelineJson,
        );
    }
}
