<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationPipelineRunner
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationRunner $publicationRunner = new OrderSalesShadowReleaseManifestPublicationRunner(),
        private readonly OrderSalesShadowReleaseManifestPublicationResultSerializer $serializer = new OrderSalesShadowReleaseManifestPublicationResultSerializer(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineInput $input)
    {
        $publicationResult = $this->publicationRunner->run(
            input: $input->packageInput,
            envelopeGeneratedAtUtc: $input->envelopeGeneratedAtUtc,
            checksumAlgorithm: $input->checksumAlgorithm,
        );

        $publicationArray = $this->serializer->toArray($publicationResult);
        $publicationJson = $this->serializer->toJson($publicationResult);

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineResult';

        return new $resultClass(
            generatedAtUtc: $input->pipelineGeneratedAtUtc,
            publicationResult: $publicationResult,
            publicationArray: $publicationArray,
            publicationJson: $publicationJson,
        );
    }
}
