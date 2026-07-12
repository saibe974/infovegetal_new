<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class OrderSalesShadowReleaseManifestVerification
{
    /**
     * @param list<string> $errors
     */
    public function __construct(
        public bool $isValid,
        public string $expectedManifestId,
        public string $actualManifestId,
        public array $errors,
    ) {
    }
}
