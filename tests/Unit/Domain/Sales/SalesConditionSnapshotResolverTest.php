<?php

declare(strict_types=1);

use App\Domain\Sales\Services\SalesConditionSnapshotResolver;

/**
 * Business Rules:
 * BR-018
 * BR-019
 */
it('resolves inherited billing profile conditions then merges seller defaults and client overrides', function (): void {
    $resolver = new SalesConditionSnapshotResolver;

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
    $resolver = new SalesConditionSnapshotResolver;

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

it('computes total margin as billing margin plus commercial standard margin when no client margin is provided', function (): void {
    $resolver = new SalesConditionSnapshotResolver;

    $snapshot = $resolver->resolve(
        defaults: [
            'default_profile_id' => 'standard',
            'profiles' => [
                ['id' => 'standard', 'conditions' => ['m' => 20]],
                ['id' => 'profile-1783695735132', 'conditions' => ['m' => 15]],
            ],
        ],
        sellerRuleData: [
            'use_billing_profile' => true,
            'billing_profile_id' => 'profile-1783695735132',
            'seller_defaults' => [
                'default_profile_id' => 'standard',
                'profiles' => [
                    ['id' => 'standard', 'conditions' => ['m' => 5]],
                ],
            ],
        ],
        clientOverride: [],
    );

    expect($snapshot['billing_to_seller_conditions'])->toBe([
        'm' => 15,
    ])->and($snapshot['seller_defaults'])->toBe([
        'm' => 5,
    ])->and($snapshot['resolved']['m'])->toBe(20.0);
});

it('uses client margin as commercial margin and adds it to billing margin when commercial relation exists', function (): void {
    $resolver = new SalesConditionSnapshotResolver;

    $snapshot = $resolver->resolve(
        defaults: [
            'default_profile_id' => 'standard',
            'profiles' => [
                ['id' => 'standard', 'conditions' => ['m' => 20]],
                ['id' => 'profile-1783695735132', 'conditions' => ['m' => 15]],
            ],
        ],
        sellerRuleData: [
            'use_billing_profile' => true,
            'billing_profile_id' => 'profile-1783695735132',
            'seller_defaults' => [
                'default_profile_id' => 'standard',
                'profiles' => [
                    ['id' => 'standard', 'conditions' => ['m' => 5]],
                ],
            ],
        ],
        clientOverride: [
            'm' => 10,
        ],
    );

    expect($snapshot['billing_to_seller_conditions'])->toBe([
        'm' => 15,
    ])->and($snapshot['resolved']['m'])->toBe(25.0);
});

it('adds billing and commercial tier margins for mc me mr when commercial relation exists', function (): void {
    $resolver = new SalesConditionSnapshotResolver;

    $snapshot = $resolver->resolve(
        defaults: [
            'default_profile_id' => 'standard',
            'profiles' => [
                ['id' => 'standard', 'conditions' => ['mc' => 10, 'me' => 20, 'mr' => 30]],
            ],
        ],
        sellerRuleData: [
            'use_billing_profile' => true,
            'billing_profile_id' => 'standard',
            'seller_defaults' => [
                'default_profile_id' => 'standard',
                'profiles' => [
                    ['id' => 'standard', 'conditions' => ['mc' => 2, 'me' => 3, 'mr' => 4]],
                ],
            ],
        ],
        clientOverride: [
            'me' => 5,
        ],
    );

    expect($snapshot['resolved'])->toMatchArray([
        'mc' => 12.0,
        'me' => 25.0,
        'mr' => 34.0,
    ]);
});

it('ignores commercial pricing conditions when its profile uses retro commission', function (): void {
    $resolver = new SalesConditionSnapshotResolver;

    $snapshot = $resolver->resolve(
        defaults: [
            'default_profile_id' => 'standard',
            'profiles' => [
                ['id' => 'standard', 'conditions' => ['m' => 15, 'mc' => 10]],
            ],
        ],
        sellerRuleData: [
            'use_billing_profile' => true,
            'billing_profile_id' => 'standard',
            'seller_defaults' => [
                'default_profile_id' => 'retro',
                'profiles' => [
                    ['id' => 'retro', 'conditions' => [
                        'retro_com' => 1,
                        'billing_margin' => 7.5,
                        'm' => 20,
                        'mc' => 30,
                    ]],
                ],
            ],
        ],
    );

    expect($snapshot['seller_defaults'])->toMatchArray([
        'retro_com' => 1,
        'billing_margin' => 7.5,
        'm' => 20,
        'mc' => 30,
    ])->and($snapshot['resolved'])->toMatchArray([
        'retro_com' => 1,
        'billing_margin' => 7.5,
        'm' => 15.0,
        'mc' => 10.0,
    ]);
});
