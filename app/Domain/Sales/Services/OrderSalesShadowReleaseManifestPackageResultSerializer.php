<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPackageResultSerializer
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPackageSerializer $packageSerializer = new OrderSalesShadowReleaseManifestPackageSerializer(),
        private readonly OrderSalesShadowReleaseManifestPackageVerificationSerializer $verificationSerializer = new OrderSalesShadowReleaseManifestPackageVerificationSerializer(),
    ) {
    }

    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageResult $result): array
    {
        return [
            'package' => $this->packageSerializer->toArray($result->package),
            'verification' => $this->verificationSerializer->toArray($result->verification),
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageResult $result): string
    {
        return (string) json_encode(
            $this->toArray($result),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
