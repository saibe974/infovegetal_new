<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDecision;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResult;

it('verifies governance result consistency and serializes verification payload', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceRunner';
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceVerifier';
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceVerificationSerializer';

    $runner = new $runnerClass();
    $verifier = new $verifierClass();
    $serializer = new $serializerClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';

    $result = $runner->run(new $inputClass(
        pipelineInput: new $pipelineInputClass(
            packageInput: buildPublicationPipelineEnvelopePackageInput(1, 5),
            envelopeGeneratedAtUtc: '2026-07-13T22:40:00Z',
            pipelineGeneratedAtUtc: '2026-07-13T22:42:00Z',
            checksumAlgorithm: 'sha256',
        ),
        envelopeGeneratedAtUtc: '2026-07-13T22:44:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $verification = $verifier->verify($result);
    $payload = $serializer->toArray($verification);

    expect($verification->isValid)->toBeTrue()
        ->and($payload['is_valid'])->toBeTrue()
        ->and($payload['errors'])->toBe([]);

    $tampered = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResult(
        envelopeResult: $result->envelopeResult,
        publicationDecision: new OrderSalesShadowReleaseManifestPublicationDecision(
            action: 'publish_manifest',
            approved: true,
            integrityVerified: false,
            releaseAction: $result->publicationDecision->releaseAction,
            reasons: ['Tampered decision.'],
        ),
    );

    $tamperedVerification = $verifier->verify($tampered);
    $json = $serializer->toJson($tamperedVerification);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($tamperedVerification->isValid)->toBeFalse()
        ->and($decoded['is_valid'])->toBeFalse()
        ->and($decoded['errors'])->toContain('integrityVerified mismatch between publication decision and envelope verification.');
});
