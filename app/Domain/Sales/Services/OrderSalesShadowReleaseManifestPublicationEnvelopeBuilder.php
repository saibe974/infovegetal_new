<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationEnvelopeBuilder
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPackageGovernanceRunner $governanceRunner = new OrderSalesShadowReleaseManifestPackageGovernanceRunner(),
        private readonly OrderSalesShadowReleaseManifestPackageGovernanceResultSerializer $governanceSerializer = new OrderSalesShadowReleaseManifestPackageGovernanceResultSerializer(),
    ) {
    }

    /**
     * @return object
     */
    public function build(
        \App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageInput $input,
        string $envelopeGeneratedAtUtc,
        string $checksumAlgorithm = 'sha256',
    ) {
        if ($checksumAlgorithm !== 'sha256') {
            throw new \InvalidArgumentException('Only sha256 checksum is supported.');
        }

        $governanceResult = $this->governanceRunner->run($input);
        $governanceArray = $this->governanceSerializer->toArray($governanceResult);
        $governanceJson = $this->governanceSerializer->toJson($governanceResult);

        $checksum = hash($checksumAlgorithm, $governanceJson);

        $envelopeClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationEnvelope';

        return new $envelopeClass(
            generatedAtUtc: $envelopeGeneratedAtUtc,
            checksumAlgorithm: $checksumAlgorithm,
            checksum: $checksum,
            governanceResult: $governanceResult,
            governanceArray: $governanceArray,
            governanceJson: $governanceJson,
        );
    }
}
