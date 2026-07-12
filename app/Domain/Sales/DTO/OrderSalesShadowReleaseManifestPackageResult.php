<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPackageResult
{
    public function __construct(
        public OrderSalesShadowReleaseManifestPackage $package,
        public OrderSalesShadowReleaseManifestPackageVerification $verification,
    ) {
    }
}
