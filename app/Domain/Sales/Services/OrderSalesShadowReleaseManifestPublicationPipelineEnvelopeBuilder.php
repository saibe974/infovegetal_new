<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeBuilder
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineRunner $pipelineRunner = new OrderSalesShadowReleaseManifestPublicationPipelineRunner(),
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineSerializer $pipelineSerializer = new OrderSalesShadowReleaseManifestPublicationPipelineSerializer(),
    ) {
    }

    /**
     * @return object
     */
    public function build(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput $input)
    {
        if ($input->checksumAlgorithm !== 'sha256') {
            throw new \InvalidArgumentException('Only sha256 checksum is supported.');
        }

        $pipelineResult = $this->pipelineRunner->run($input->pipelineInput);
        $pipelineArray = $this->pipelineSerializer->toArray($pipelineResult);
        $pipelineJson = $this->pipelineSerializer->toJson($pipelineResult);

        $checksum = hash($input->checksumAlgorithm, $pipelineJson);
        $envelopeClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelope';

        return new $envelopeClass(
            generatedAtUtc: $input->envelopeGeneratedAtUtc,
            checksumAlgorithm: $input->checksumAlgorithm,
            checksum: $checksum,
            pipelineResult: $pipelineResult,
            pipelineArray: $pipelineArray,
            pipelineJson: $pipelineJson,
        );
    }
}
