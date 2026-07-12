<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationRunner
{
    public function __construct(
        private readonly OrderSalesShadowReleaseManifestPublicationEnvelopeRunner $envelopeRunner = new OrderSalesShadowReleaseManifestPublicationEnvelopeRunner(),
    ) {
    }

    /**
     * @return object
     */
    public function run(
        \App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPackageInput $input,
        string $envelopeGeneratedAtUtc,
        string $checksumAlgorithm = 'sha256',
    ) {
        $envelopeResult = $this->envelopeRunner->run(
            input: $input,
            envelopeGeneratedAtUtc: $envelopeGeneratedAtUtc,
            checksumAlgorithm: $checksumAlgorithm,
        );

        $decision = $envelopeResult->envelope->governanceResult->publicationDecision;

        if (!$envelopeResult->verification->isValid) {
            $decisionClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDecision';

            $decision = new $decisionClass(
                action: 'reject_manifest_publication',
                approved: false,
                integrityVerified: false,
                releaseAction: $decision->releaseAction,
                reasons: array_values(array_merge(
                    ['Publication envelope verification failed.'],
                    $envelopeResult->verification->errors,
                )),
            );
        }

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationResult';

        return new $resultClass(
            envelopeResult: $envelopeResult,
            publicationDecision: $decision,
        );
    }
}
