<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelope;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResult;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerification;

it('keeps publication decision when envelope verification is valid', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeRunner';
    $assessorClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceAssessor';

    $runner = new $runnerClass();
    $assessor = new $assessorClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';

    $result = $runner->run(new $inputClass(
        pipelineInput: new $pipelineInputClass(
            packageInput: buildPublicationPipelineEnvelopePackageInput(1, 5),
            envelopeGeneratedAtUtc: '2026-07-13T22:00:00Z',
            pipelineGeneratedAtUtc: '2026-07-13T22:02:00Z',
            checksumAlgorithm: 'sha256',
        ),
        envelopeGeneratedAtUtc: '2026-07-13T22:04:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $decision = $assessor->assess($result);

    expect($result->verification->isValid)->toBeTrue()
        ->and($decision->action)->toBe('publish_manifest')
        ->and($decision->approved)->toBeTrue();
});

it('rejects publication when envelope verification is invalid', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeRunner';
    $assessorClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeGovernanceAssessor';

    $runner = new $runnerClass();
    $assessor = new $assessorClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeInput';
    $pipelineInputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';

    $validResult = $runner->run(new $inputClass(
        pipelineInput: new $pipelineInputClass(
            packageInput: buildPublicationPipelineEnvelopePackageInput(1, 5),
            envelopeGeneratedAtUtc: '2026-07-13T22:10:00Z',
            pipelineGeneratedAtUtc: '2026-07-13T22:12:00Z',
            checksumAlgorithm: 'sha256',
        ),
        envelopeGeneratedAtUtc: '2026-07-13T22:14:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $tamperedEnvelope = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelope(
        generatedAtUtc: $validResult->envelope->generatedAtUtc,
        checksumAlgorithm: $validResult->envelope->checksumAlgorithm,
        checksum: str_repeat('0', 64),
        pipelineResult: $validResult->envelope->pipelineResult,
        pipelineArray: $validResult->envelope->pipelineArray,
        pipelineJson: $validResult->envelope->pipelineJson,
    );

    $tamperedResult = new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeResult(
        envelope: $tamperedEnvelope,
        verification: new OrderSalesShadowReleaseManifestPublicationPipelineEnvelopeVerification(
            isValid: false,
            expectedChecksum: hash('sha256', $tamperedEnvelope->pipelineJson),
            actualChecksum: $tamperedEnvelope->checksum,
            algorithm: 'sha256',
            errors: ['Checksum mismatch between publication pipeline envelope and pipeline payload.'],
        ),
    );

    $decision = $assessor->assess($tamperedResult);

    expect($decision->action)->toBe('reject_manifest_publication')
        ->and($decision->approved)->toBeFalse()
        ->and($decision->reasons)->toContain('Publication pipeline envelope verification failed.');
});
