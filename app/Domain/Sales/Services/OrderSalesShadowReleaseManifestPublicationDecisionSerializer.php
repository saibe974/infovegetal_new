<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationDecisionSerializer
{
    public function toArray(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDecision $decision): array
    {
        return [
            'action' => $decision->action,
            'approved' => $decision->approved,
            'integrity_verified' => $decision->integrityVerified,
            'release_action' => $decision->releaseAction,
            'reasons' => array_values($decision->reasons),
        ];
    }

    public function toJson(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDecision $decision): string
    {
        return (string) json_encode(
            $this->toArray($decision),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
