<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionPlan;
use App\Domain\Sales\DTO\OrderSalesShadowReleaseExecutionStep;

it('serializes execution plan to deterministic array', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseExecutionPlanSerializer';
    $serializer = new $serializerClass();

    $plan = new OrderSalesShadowReleaseExecutionPlan(
        generatedAtUtc: '2026-07-13T02:00:00Z',
        releaseAction: 'approve_release',
        approved: true,
        summary: 'Release approved with rollout phases.',
        steps: [
            new OrderSalesShadowReleaseExecutionStep(
                order: 1,
                title: 'Publish rollout configuration',
                type: 'rollout',
                mandatory: true,
                checks: ['Apply rollout action', 'Record envelope checksum'],
            ),
            new OrderSalesShadowReleaseExecutionStep(
                order: 2,
                title: 'Execute phase: canary',
                type: 'phase',
                mandatory: true,
                checks: ['Traffic percent: 10', 'Duration hours: 24'],
            ),
        ],
    );

    $array = $serializer->toArray($plan);

    expect($array)->toBe([
        'generated_at_utc' => '2026-07-13T02:00:00Z',
        'release_action' => 'approve_release',
        'approved' => true,
        'summary' => 'Release approved with rollout phases.',
        'steps' => [
            [
                'order' => 1,
                'title' => 'Publish rollout configuration',
                'type' => 'rollout',
                'mandatory' => true,
                'checks' => ['Apply rollout action', 'Record envelope checksum'],
            ],
            [
                'order' => 2,
                'title' => 'Execute phase: canary',
                'type' => 'phase',
                'mandatory' => true,
                'checks' => ['Traffic percent: 10', 'Duration hours: 24'],
            ],
        ],
    ]);
});

it('serializes execution plan to valid json', function (): void {
    $serializerClass = 'App\\Domain\\Sales\\Services\\OrderSalesShadowReleaseExecutionPlanSerializer';
    $serializer = new $serializerClass();

    $plan = new OrderSalesShadowReleaseExecutionPlan(
        generatedAtUtc: '2026-07-13T02:05:00Z',
        releaseAction: 'hold_release',
        approved: false,
        summary: 'Release is on hold.',
        steps: [
            new OrderSalesShadowReleaseExecutionStep(
                order: 1,
                title: 'Keep shadow-only mode',
                type: 'hold',
                mandatory: true,
                checks: ['Do not enable production rollout'],
            ),
        ],
    );

    $json = $serializer->toJson($plan);
    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($decoded['release_action'])->toBe('hold_release')
        ->and($decoded['approved'])->toBeFalse()
        ->and($decoded['steps'][0]['type'])->toBe('hold');
});
