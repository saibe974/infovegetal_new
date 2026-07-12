<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPackageGovernanceRunner
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPackageRunner $packageRunner = new OrderSalesShadowReleaseManifestPackageRunner(),
        private readonly OrderSalesShadowReleaseManifestPublicationAssessor $publicationAssessor = new OrderSalesShadowReleaseManifestPublicationAssessor(),
    ) {
    }

    /**
     * @return object
     */
    public function run(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageInput $input)
    {
        $packageResult = $this->packageRunner->run($input);
        $publicationDecision = $this->publicationAssessor->assess($packageResult);

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPackageGovernanceResult';

        return new $resultClass(
            packageResult: $packageResult,
            publicationDecision: $publicationDecision,
        );
    }
}
