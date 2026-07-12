<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifest;

it('validates manifest when header and payload are consistent with canonical hash', function (): void {
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestVerifier';
    $verifier = new $verifierClass();

    $payload = [
        'execution_package' => [
            'generated_at_utc' => '2026-07-13T05:00:00Z',
            'release_action' => 'approve_release',
            'approved' => true,
        ],
        'readiness_report' => [
            'status' => 'ready',
            'release_action' => 'approve_release',
            'approved' => true,
            'integrity_valid' => true,
            'required_steps' => 3,
            'remediation_steps' => 0,
            'blocking_issues' => [],
            'warnings' => [],
        ],
    ];

    $canonical = [
        'schema_version' => '1.0',
        'payload' => $payload,
    ];

    $manifest = new OrderSalesShadowReleaseManifest(
        generatedAtUtc: '2026-07-13T05:05:00Z',
        schemaVersion: '1.0',
        manifestId: hash('sha256', (string) json_encode($canonical, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
        status: 'ready',
        releaseAction: 'approve_release',
        approved: true,
        integrityValid: true,
        requiredSteps: 3,
        remediationSteps: 0,
        payload: $payload,
    );

    $verification = $verifier->verify($manifest);

    expect($verification->isValid)->toBeTrue()
        ->and($verification->errors)->toBe([])
        ->and($verification->expectedManifestId)->toBe($verification->actualManifestId);
});

it('fails when manifest id is tampered', function (): void {
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestVerifier';
    $verifier = new $verifierClass();

    $payload = [
        'readiness_report' => [
            'status' => 'ready',
            'release_action' => 'approve_release',
            'approved' => true,
        ],
    ];

    $manifest = new OrderSalesShadowReleaseManifest(
        generatedAtUtc: '2026-07-13T05:10:00Z',
        schemaVersion: '1.0',
        manifestId: str_repeat('0', 64),
        status: 'ready',
        releaseAction: 'approve_release',
        approved: true,
        integrityValid: true,
        requiredSteps: 1,
        remediationSteps: 0,
        payload: $payload,
    );

    $verification = $verifier->verify($manifest);

    expect($verification->isValid)->toBeFalse()
        ->and($verification->errors)->toContain('manifestId does not match canonical payload hash.');
});

it('fails when manifest header diverges from payload readiness section', function (): void {
    $verifierClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestVerifier';
    $verifier = new $verifierClass();

    $payload = [
        'readiness_report' => [
            'status' => 'hold',
            'release_action' => 'hold_release',
            'approved' => false,
        ],
    ];

    $canonical = [
        'schema_version' => '1.0',
        'payload' => $payload,
    ];

    $manifest = new OrderSalesShadowReleaseManifest(
        generatedAtUtc: '2026-07-13T05:15:00Z',
        schemaVersion: '1.0',
        manifestId: hash('sha256', (string) json_encode($canonical, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
        status: 'ready',
        releaseAction: 'approve_release',
        approved: true,
        integrityValid: true,
        requiredSteps: 1,
        remediationSteps: 0,
        payload: $payload,
    );

    $verification = $verifier->verify($manifest);

    expect($verification->isValid)->toBeFalse()
        ->and($verification->errors)->toContain('status mismatch between manifest header and payload readiness report.')
        ->and($verification->errors)->toContain('releaseAction mismatch between manifest header and payload readiness report.')
        ->and($verification->errors)->toContain('approved mismatch between manifest header and payload readiness report.');
});
