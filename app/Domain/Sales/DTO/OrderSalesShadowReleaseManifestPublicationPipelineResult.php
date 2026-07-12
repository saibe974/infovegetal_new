<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationPipelineResult
{
    public function __construct(
        public string $generatedAtUtc,
        public OrderSalesShadowReleaseManifestPublicationResult $publicationResult,
        public array $publicationArray,
        public string $publicationJson,
    ) {
    }
}
