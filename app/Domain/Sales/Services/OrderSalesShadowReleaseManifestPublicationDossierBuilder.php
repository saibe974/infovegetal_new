<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationDossierBuilder
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceRunner $governanceRunner = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceRunner(),
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceVerifier $governanceVerifier = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceVerifier(),
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResultSerializer $governanceResultSerializer = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResultSerializer(),
        private readonly OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceVerificationSerializer $governanceVerificationSerializer = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceVerificationSerializer(),
    ) {
    }

    /**
     * @return object
     */
    public function build(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDossierInput $input)
    {
        if ($input->checksumAlgorithm !== 'sha256') {
            throw new \InvalidArgumentException('Only sha256 checksum is supported.');
        }

        $governanceResult = $this->governanceRunner->run($input->governanceInput);
        $governanceVerification = $this->governanceVerifier->verify($governanceResult);

        $governanceArray = [
            'result' => $this->governanceResultSerializer->toArray($governanceResult),
            'verification' => $this->governanceVerificationSerializer->toArray($governanceVerification),
        ];

        $governanceJson = (string) json_encode(
            $governanceArray,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        $checksum = hash($input->checksumAlgorithm, $governanceJson);
        $dossierClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDossier';

        return new $dossierClass(
            generatedAtUtc: $input->dossierGeneratedAtUtc,
            checksumAlgorithm: $input->checksumAlgorithm,
            checksum: $checksum,
            governanceResult: $governanceResult,
            governanceVerification: $governanceVerification,
            governanceArray: $governanceArray,
            governanceJson: $governanceJson,
        );
    }
}
