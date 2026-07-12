<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestVerificationSerializer
{
    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestVerification $verification): array
    {
        return [
            'is_valid' => $verification->isValid,
            'expected_manifest_id' => $verification->expectedManifestId,
            'actual_manifest_id' => $verification->actualManifestId,
            'errors' => array_values($verification->errors),
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestVerification $verification): string
    {
        return (string) json_encode(
            $this->toArray($verification),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
