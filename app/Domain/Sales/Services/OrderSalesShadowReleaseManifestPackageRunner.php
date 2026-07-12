<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPackageRunner
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPackageBuilder $builder = new OrderSalesShadowReleaseManifestPackageBuilder(),
        private readonly OrderSalesShadowReleaseManifestPackageVerifier $verifier = new OrderSalesShadowReleaseManifestPackageVerifier(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageInput $input)
    {
        $package = $this->builder->build($input);
        $verification = $this->verifier->verify($package);

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPackageResult';

        return new $resultClass(
            package: $package,
            verification: $verification,
        );
    }
}
