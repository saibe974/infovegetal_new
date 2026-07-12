<?php

declare(strict_types=1);

it('serializes publication pipeline to deterministic array', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineRunner';
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineSerializer';

    $runner = new $runnerClass();
    $serializer = new $serializerClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';
    $pipeline = $runner->run(new $inputClass(
        packageInput: buildPublicationPipelinePackageInput(1, 5),
        envelopeGeneratedAtUtc: '2026-07-13T20:00:00Z',
        pipelineGeneratedAtUtc: '2026-07-13T20:05:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $array = $serializer->toArray($pipeline);

    expect($array['generated_at_utc'])->toBe('2026-07-13T20:05:00Z')
        ->and($array['publication_result']['publication_decision']['action'])->toBe('publish_manifest')
        ->and($array['publication_payload']['publication_decision']['action'])->toBe('publish_manifest');
});

it('serializes publication pipeline to valid json', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineRunner';
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineSerializer';

    $runner = new $runnerClass();
    $serializer = new $serializerClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';
    $pipeline = $runner->run(new $inputClass(
        packageInput: buildPublicationPipelinePackageInput(1, 5),
        envelopeGeneratedAtUtc: '2026-07-13T20:10:00Z',
        pipelineGeneratedAtUtc: '2026-07-13T20:15:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $json = $serializer->toJson($pipeline);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['publication_result']['envelope_result']['verification']['is_valid'])->toBeTrue()
        ->and($decoded['publication_result']['publication_decision']['approved'])->toBeTrue();
});
