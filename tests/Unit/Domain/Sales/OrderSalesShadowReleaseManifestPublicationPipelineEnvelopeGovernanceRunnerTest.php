<?php

declare(strict_types=1);

it('runs publication pipeline envelope governance and serializes deterministic payload', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceRunner';
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceResultSerializer';

    $runner = new $runnerClass();
    $serializer = new $serializerClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';

    $result = $runner->run(new $inputClass(
        pipelineInput: new $pipelineInputClass(
            packageInput: buildPublicationPipelineEnvelopePackageInput(1, 5),
            envelopeGeneratedAtUtc: '2026-07-13T22:20:00Z',
            pipelineGeneratedAtUtc: '2026-07-13T22:22:00Z',
            checksumAlgorithm: 'sha256',
        ),
        envelopeGeneratedAtUtc: '2026-07-13T22:24:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $array = $serializer->toArray($result);
    $json = $serializer->toJson($result);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($result->publicationDecision->action)->toBe('publish_manifest')
        ->and($array['publication_decision']['action'])->toBe('publish_manifest')
        ->and($decoded['envelope_result']['verification']['is_valid'])->toBeTrue();
});
