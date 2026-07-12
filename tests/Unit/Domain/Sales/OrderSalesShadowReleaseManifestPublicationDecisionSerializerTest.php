<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestPublicationDecision;

it('serializes manifest publication decision to deterministic array', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationDecisionSerializer';
    $serializer = new $serializerClass();

    $decision = new OrderSalesShadowReleaseManifestPublicationDecision(
        action: 'publish_manifest',
        approved: true,
        integrityVerified: true,
        releaseAction: 'approve_release',
        reasons: ['Manifest package integrity verified.', 'Release action is approve_release.'],
    );

    $array = $serializer->toArray($decision);

    expect($array)->toBe([
        'action' => 'publish_manifest',
        'approved' => true,
        'integrity_verified' => true,
        'release_action' => 'approve_release',
        'reasons' => ['Manifest package integrity verified.', 'Release action is approve_release.'],
    ]);
});

it('serializes manifest publication decision to valid json', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestPublicationDecisionSerializer';
    $serializer = new $serializerClass();

    $decision = new OrderSalesShadowReleaseManifestPublicationDecision(
        action: 'hold_manifest_publication',
        approved: false,
        integrityVerified: true,
        releaseAction: 'hold_release',
        reasons: ['Manifest package integrity verified.', 'Release action is hold_release; keep manifest internal.'],
    );

    $json = $serializer->toJson($decision);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['action'])->toBe('hold_manifest_publication')
        ->and($decoded['approved'])->toBeFalse()
        ->and($decoded['release_action'])->toBe('hold_release');
});
