<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseReadinessResult
{
    public function __construct(
        public OrderSalesShadowReleaseExecutionPackage $executionPackage,
        public OrderSalesShadowReleaseExecutionPackageVerification $executionPackageVerification,
        public OrderSalesShadowReleaseReadinessReport $readinessReport,
    ) {
    }
}
