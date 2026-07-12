<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifest;

it('serializes release manifest to deterministic array', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestSerializer';
    $serializer = new $serializerClass();

    $manifest = new OrderSalesShadowReleaseManifest(
        generatedAtUtc: '2026-07-13T04:40:00Z',
        schemaVersion: '1.0',
        manifestId: 'abc123',
        status: 'ready',
        releaseAction: 'approve_release',
        approved: true,
        integrityValid: true,
        requiredSteps: 3,
        remediationSteps: 0,
        payload: [
            'execution_package' => [
                'generated_at_utc' => '2026-07-13T04:30:00Z',
                'release_action' => 'approve_release',
                'approved' => true,
            ],
            'readiness_report' => [
                'status' => 'ready',
            ],
        ],
    );

    $array = $serializer->toArray($manifest);

    expect($array)->toBe([
        'generated_at_utc' => '2026-07-13T04:40:00Z',
        'schema_version' => '1.0',
        'manifest_id' => 'abc123',
        'status' => 'ready',
        'release_action' => 'approve_release',
        'approved' => true,
        'integrity_valid' => true,
        'required_steps' => 3,
        'remediation_steps' => 0,
        'payload' => [
            'execution_package' => [
                'generated_at_utc' => '2026-07-13T04:30:00Z',
                'release_action' => 'approve_release',
                'approved' => true,
            ],
            'readiness_report' => [
                'status' => 'ready',
            ],
        ],
    ]);
});

it('serializes release manifest to valid json', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestSerializer';
    $serializer = new $serializerClass();

    $manifest = new OrderSalesShadowReleaseManifest(
        generatedAtUtc: '2026-07-13T04:41:00Z',
        schemaVersion: '1.0',
        manifestId: 'def456',
        status: 'hold',
        releaseAction: 'hold_release',
        approved: false,
        integrityValid: true,
        requiredSteps: 2,
        remediationSteps: 0,
        payload: ['readiness_report' => ['status' => 'hold']],
    );

    $json = $serializer->toJson($manifest);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['manifest_id'])->toBe('def456')
        ->and($decoded['status'])->toBe('hold')
        ->and($decoded['release_action'])->toBe('hold_release')
        ->and($decoded['approved'])->toBeFalse();
});
