<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestPublicationDossierVerification
{
    /**
     * @param list<string> $errors
     */
    public function __construct(
        public bool $isValid,
        public string $expectedChecksum,
        public string $actualChecksum,
        public string $algorithm,
        public array $errors,
    ) {
    }
}
