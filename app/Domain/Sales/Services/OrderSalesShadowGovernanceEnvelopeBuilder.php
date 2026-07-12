<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowGovernanceEnvelopeBuilder
{
    public function __construct(
        private readonly OrderSalesShadowGovernancePackageBuilder $packageBuilder = new OrderSalesShadowGovernancePackageBuilder(),
    ) {
    }

    /**
     * @return object
     */
    public function build(
        \App\Domain\Sales\DTO\OrderSalesShadowGovernanceInput $input,
        string $packageGeneratedAtUtc,
        string $envelopeGeneratedAtUtc,
        string $checksumAlgorithm = 'sha256',
    ) {
        if ($checksumAlgorithm !== 'sha256') {
            throw new \InvalidArgumentException('Only sha256 checksum is supported.');
        }

        $package = $this->packageBuilder->build(
            input: $input,
            generatedAtUtc: $packageGeneratedAtUtc,
        );

        $checksum = hash($checksumAlgorithm, $package->governanceJson);

        $envelopeClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernanceEnvelope';

        return new $envelopeClass(
            generatedAtUtc: $envelopeGeneratedAtUtc,
            checksumAlgorithm: $checksumAlgorithm,
            checksum: $checksum,
            package: $package,
        );
    }
}
