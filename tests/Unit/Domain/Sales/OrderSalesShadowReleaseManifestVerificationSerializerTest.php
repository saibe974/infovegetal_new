<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowReleaseManifestVerification;

it('serializes release manifest verification to deterministic array', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestVerificationSerializer';
    $serializer = new $serializerClass();

    $verification = new OrderSalesShadowReleaseManifestVerification(
        isValid: false,
        expectedManifestId: 'abc123',
        actualManifestId: 'def456',
        errors: ['manifestId does not match canonical payload hash.'],
    );

    $array = $serializer->toArray($verification);

    expect($array)->toBe([
        'is_valid' => false,
        'expected_manifest_id' => 'abc123',
        'actual_manifest_id' => 'def456',
        'errors' => ['manifestId does not match canonical payload hash.'],
    ]);
});

it('serializes release manifest verification to valid json', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseManifestVerificationSerializer';
    $serializer = new $serializerClass();

    $verification = new OrderSalesShadowReleaseManifestVerification(
        isValid: true,
        expectedManifestId: 'aaa',
        actualManifestId: 'aaa',
        errors: [],
    );

    $json = $serializer->toJson($verification);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['is_valid'])->toBeTrue()
        ->and($decoded['expected_manifest_id'])->toBe('aaa')
        ->and($decoded['actual_manifest_id'])->toBe('aaa')
        ->and($decoded['errors'])->toBe([]);
});
