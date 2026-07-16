<?php

declare(strict_types=1);

use App\Domain\Sales\Services\SalesConditionSnapshotResolver;

/**
 * Business Rules:
 * BR-018
 * BR-019
 */
it('resolves inherited billing profile conditions then merges seller defaults and client overrides', function (): void {
    $resolver = new SalesConditionSnapshotResolver();

    $snapshot = $resolver->resolve(
        defaults: [
            'default_profile_id' => 'pro',
            'profiles' => [
                ['id' => 'base', 'conditions' => ['shipping' => ['mode' => 'standard', 'fee' => 120], 'priority' => 'billing-base']],
                ['id' => 'pro', 'conditions' => ['shipping' => ['mode' => 'express', 'fee' => 200], 'priority' => 'billing-pro']],
            ],
        ],
        sellerRuleData: [
            'conditions' => ['priority' => 'seller-direct', 'shipping' => ['fee' => 95]],
            'seller_defaults' => ['priority' => 'seller-defaults', 'shipping' => ['fee' => 70]],
            'use_billing_profile' => true,
            'billing_profile_id' => 'pro',
        ],
        clientOverride: ['priority' => 'client', 'shipping' => ['fee' => 50]],
    );

    expect($snapshot['billing_to_seller_conditions'])->toBe([
        'shipping' => ['mode' => 'express', 'fee' => 200],
        'priority' => 'billing-pro',
    ])->and($snapshot['seller_defaults'])->toBe([
        'priority' => 'seller-defaults',
        'shipping' => ['fee' => 70],
    ])->and($snapshot['client_override'])->toBe([
        'priority' => 'client',
        'shipping' => ['fee' => 50],
    ])->and($snapshot['resolved'])->toBe([
        'shipping' => ['mode' => 'express', 'fee' => 50],
        'priority' => 'client',
    ]);
});

/**
 * Business Rules:
 * BR-019
 */
it('selects the default profile and falls back to the first profile when needed', function (): void {
    $resolver = new SalesConditionSnapshotResolver();

    expect($resolver->extractDefaultConditions([
        'default_profile_id' => 'pro',
        'profiles' => [
            ['id' => 'base', 'conditions' => ['priority' => 'base', 'shipping' => ['fee' => 120]]],
            ['id' => 'pro', 'conditions' => ['priority' => 'pro', 'shipping' => ['fee' => 200]]],
        ],
    ]))->toBe([
        'priority' => 'pro',
        'shipping' => ['fee' => 200],
    ])->and($resolver->extractDefaultConditions([
        'default_profile_id' => 'missing',
        'profiles' => [
            ['id' => 'base', 'conditions' => ['priority' => 'base', 'shipping' => ['fee' => 120]]],
            ['id' => 'pro', 'conditions' => ['priority' => 'pro', 'shipping' => ['fee' => 200]]],
        ],
    ]))->toBe([
        'priority' => 'base',
        'shipping' => ['fee' => 120],
    ]);
});