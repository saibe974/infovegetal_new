<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class OrderSalesShadowReleaseManifestPublicationDossierVerifier
{
    /**
     * @return object
     */
    public function verify(\App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDossier $dossier)
    {
        $errors = [];
        $algorithm = strtolower($dossier->checksumAlgorithm);

        if ($algorithm !== 'sha256') {
            $errors[] = 'Unsupported checksum algorithm. Expected sha256.';

            $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDossierVerification';

            return new $resultClass(
                isValid: false,
                expectedChecksum: '',
                actualChecksum: $dossier->checksum,
                algorithm: $algorithm,
                errors: $errors,
            );
        }

        $expectedChecksum = hash($algorithm, $dossier->governanceJson);

        if (!hash_equals($expectedChecksum, $dossier->checksum)) {
            $errors[] = 'Checksum mismatch between dossier and governance payload.';
        }

        $decodedJson = json_decode($dossier->governanceJson, true);
        if (!is_array($decodedJson)) {
            $errors[] = 'governanceJson is not valid JSON object/array.';
        } elseif ($decodedJson !== $dossier->governanceArray) {
            $errors[] = 'governanceArray does not match decoded governanceJson.';
        }

        $arrayAction = $dossier->governanceArray['result']['publication_decision']['action'] ?? null;
        $objectAction = $dossier->governanceResult->publicationDecision->action;
        if (!is_string($arrayAction) || $arrayAction !== $objectAction) {
            $errors[] = 'publication decision action mismatch between object and governance payload.';
        }

        $arrayGovValid = $dossier->governanceArray['verification']['is_valid'] ?? null;
        $objectGovValid = $dossier->governanceVerification->isValid;
        if (!is_bool($arrayGovValid) || $arrayGovValid !== $objectGovValid) {
            $errors[] = 'governance verification mismatch between object and governance payload.';
        }

        $resultClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationDossierVerification';

        return new $resultClass(
            isValid: count($errors) === 0,
            expectedChecksum: $expectedChecksum,
            actualChecksum: $dossier->checksum,
            algorithm: $algorithm,
            errors: $errors,
        );
    }
}
