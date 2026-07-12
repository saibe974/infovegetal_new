<?php

declare(strict_types=1);

it('serializes publication pipeline verification to deterministic array', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineRunner';
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineVerifier';
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineVerificationSerializer';

    $runner = new $runnerClass();
    $verifier = new $verifierClass();
    $serializer = new $serializerClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';
    $pipeline = $runner->run(new $inputClass(
        packageInput: buildPublicationPipelinePackageInput(1, 5),
        envelopeGeneratedAtUtc: '2026-07-13T20:20:00Z',
        pipelineGeneratedAtUtc: '2026-07-13T20:25:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $verification = $verifier->verify($pipeline);
    $array = $serializer->toArray($verification);

    expect($array['is_valid'])->toBeTrue()
        ->and($array['errors'])->toBe([]);
});

it('serializes publication pipeline verification to valid json', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineRunner';
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineVerifier';
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineVerificationSerializer';

    $runner = new $runnerClass();
    $verifier = new $verifierClass();
    $serializer = new $serializerClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';
    $pipeline = $runner->run(new $inputClass(
        packageInput: buildPublicationPipelinePackageInput(1, 5),
        envelopeGeneratedAtUtc: '2026-07-13T20:30:00Z',
        pipelineGeneratedAtUtc: '2026-07-13T20:35:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $verification = $verifier->verify($pipeline);
    $json = $serializer->toJson($verification);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['is_valid'])->toBeTrue()
        ->and($decoded['errors'])->toBe([]);
});
