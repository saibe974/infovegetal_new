<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPackageSerializer
{
    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackage $package): array
    {
        return [
            'generated_at_utc' => $package->generatedAtUtc,
            'checksum_algorithm' => $package->checksumAlgorithm,
            'checksum' => $package->checksum,
            'manifest_pipeline' => $package->manifestPipelineArray,
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackage $package): string
    {
        return (string) json_encode(
            $this->toArray($package),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
