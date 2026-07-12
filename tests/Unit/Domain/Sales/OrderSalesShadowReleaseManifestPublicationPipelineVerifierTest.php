<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationPipelineResult;

it('validates publication pipeline when json payload and object are consistent', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineRunner';
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineVerifier';

    $runner = new $runnerClass();
    $verifier = new $verifierClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';
    $result = $runner->run(new $inputClass(
        packageInput: buildPublicationPipelinePackageInput(1, 5),
        envelopeGeneratedAtUtc: '2026-07-13T19:40:00Z',
        pipelineGeneratedAtUtc: '2026-07-13T19:45:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $verification = $verifier->verify($result);

    expect($verification->isValid)->toBeTrue()
        ->and($verification->errors)->toBe([]);
});

it('fails verification when publication array diverges from publication json', function (): void {
    $runnerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineRunner';
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationPipelineVerifier';

    $runner = new $runnerClass();
    $verifier = new $verifierClass();

    $inputClass = 'App\\Domain\\Sales\\DTO\\OrderSalesShadowReleaseManifestPublicationPipelineInput';
    $result = $runner->run(new $inputClass(
        packageInput: buildPublicationPipelinePackageInput(1, 5),
        envelopeGeneratedAtUtc: '2026-07-13T19:50:00Z',
        pipelineGeneratedAtUtc: '2026-07-13T19:55:00Z',
        checksumAlgorithm: 'sha256',
    ));

    $tampered = new OrderSalesShadowReleaseManifestPublicationPipelineResult(
        generatedAtUtc: $result->generatedAtUtc,
        publicationResult: $result->publicationResult,
        publicationArray: ['unexpected' => 'value'],
        publicationJson: $result->publicationJson,
    );

    $verification = $verifier->verify($tampered);

    expect($verification->isValid)->toBeFalse()
        ->and($verification->errors)->toContain('publicationArray does not match decoded publicationJson.');
});
