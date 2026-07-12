<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowGovernancePackageBuilder
{
    public function __construct(
        private readonly OrderSalesShadowGovernanceRunner $governanceRunner = new OrderSalesShadowGovernanceRunner(),
        private readonly OrderSalesShadowGovernanceResultSerializer $serializer = new OrderSalesShadowGovernanceResultSerializer(),
    ) {
    }

    /**
     * @return object
     */
    public function build(
        \App\Domain\Sales\DTO\OrderSalesShadowGovernanceInput $input,
        string $generatedAtUtc,
    ) {
        $result = $this->governanceRunner->run($input);
        $payload = $this->serializer->toArray($result);
        $json = $this->serializer->toJson($result);

        $packageClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowGovernancePackage';

        return new $packageClass(
            generatedAtUtc: $generatedAtUtc,
            governanceResult: $result,
            governanceArray: $payload,
            governanceJson: $json,
        );
    }
}
