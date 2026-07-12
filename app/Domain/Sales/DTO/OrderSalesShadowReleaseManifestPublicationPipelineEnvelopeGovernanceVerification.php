<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceVerification
{
    /**
     * @param list<string> $errors
     */
    public function __construct(
        public bool $isValid,
        public array $errors,
    ) {
    }
}
