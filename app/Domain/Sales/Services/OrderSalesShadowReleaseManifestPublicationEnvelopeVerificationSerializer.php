<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationEnvelopeVerificationSerializer
{
    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationEnvelopeVerification $verification): array
    {
        return [
            'is_valid' => $verification->isValid,
            'expected_checksum' => $verification->expectedChecksum,
            'actual_checksum' => $verification->actualChecksum,
            'algorithm' => $verification->algorithm,
            'errors' => array_values($verification->errors),
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationEnvelopeVerification $verification): string
    {
        return (string) json_encode(
            $this->toArray($verification),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
